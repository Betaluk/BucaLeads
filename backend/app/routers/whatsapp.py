import os
import re
import httpx
from datetime import datetime
from typing import List, Optional, Set
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from sqlalchemy import desc, func, or_

from app.database import get_db
from app.models import Lead, ChatMessage
from app.schemas import (
    ChatMessageResponse,
    SendMessageRequest,
    WebhookPayload,
    ConversationSummary
)

router = APIRouter(prefix="/api/whatsapp", tags=["WhatsApp"])

WHATSAPP_SERVICE_URL = os.getenv("WHATSAPP_SERVICE_URL", "http://127.0.0.1:3001")

# ==========================================
# WebSocket Connection Manager
# ==========================================
class ConnectionManager:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)

    async def broadcast(self, message: dict):
        dead_connections = set()
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except Exception:
                dead_connections.add(connection)
        for dead in dead_connections:
            self.active_connections.discard(dead)

manager = ConnectionManager()

# ==========================================
# Helpers
# ==========================================
def normalize_phone_digits(phone: str) -> str:
    """Extrai apenas os digitos do telefone e garante formato padrão."""
    if not phone:
        return ""
    digits = re.sub(r"\D", "", phone)
    if digits.startswith("55") and len(digits) >= 12:
        return digits[2:] # Retorna DDD + Número sem 55 para busca flexível
    return digits

def find_matching_lead(db: Session, phone_digits: str) -> Optional[Lead]:
    """Tenta encontrar um lead com base nos dígitos do telefone."""
    if not phone_digits or len(phone_digits) < 8:
        return None

    # Tenta busca exata ou pelos últimos 8 ou 9 dígitos
    last_8 = phone_digits[-8:]
    leads = db.query(Lead).filter(Lead.phone.isnot(None)).all()
    for l in leads:
        lead_digits = re.sub(r"\D", "", l.phone or "")
        if lead_digits.endswith(last_8):
            return l
    return None

# ==========================================
# Rotas REST
# ==========================================

@router.get("/status")
async def get_whatsapp_status():
    """Consulta o status da sessão e QR Code no microserviço Baileys."""
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            res = await client.get(f"{WHATSAPP_SERVICE_URL}/status")
            return res.json()
    except Exception:
        return {
            "status": "offline",
            "qrCode": None,
            "user": None,
            "message": "Serviço WhatsApp local não está respondendo na porta 3001."
        }

@router.post("/connect")
async def trigger_whatsapp_connect():
    """Solicita ao microserviço Baileys que inicie a conexão e gere o QR Code."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.post(f"{WHATSAPP_SERVICE_URL}/connect")
            return res.json()
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Erro conectando ao microserviço WhatsApp: {str(e)}")

@router.post("/disconnect")
async def trigger_whatsapp_disconnect():
    """Desconecta a sessão atual do WhatsApp."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            res = await client.post(f"{WHATSAPP_SERVICE_URL}/disconnect")
            return res.json()
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Erro ao desconectar WhatsApp: {str(e)}")

@router.get("/unread-count")
def get_unread_count(db: Session = Depends(get_db)):
    """Retorna o total de mensagens recebidas não lidas no sistema."""
    count = db.query(ChatMessage).filter(
        ChatMessage.direction == "incoming",
        ChatMessage.is_read == False
    ).count()
    return {"unread_total": count}

@router.get("/conversations", response_model=List[ConversationSummary])
def get_conversations(db: Session = Depends(get_db)):
    """Retorna a lista de todas as conversas agrupadas por telefone."""
    # Obter os números que possuem histórico de mensagens
    phones_with_messages = db.query(ChatMessage.phone).distinct().all()
    conversation_phones = {p[0] for p in phones_with_messages if p[0]}

    summaries: List[ConversationSummary] = []

    for phone in conversation_phones:
        # Última mensagem
        last_msg = db.query(ChatMessage).filter(
            ChatMessage.phone == phone
        ).order_by(desc(ChatMessage.created_at)).first()

        # Contagem de não lidas
        unread = db.query(ChatMessage).filter(
            ChatMessage.phone == phone,
            ChatMessage.direction == "incoming",
            ChatMessage.is_read == False
        ).count()

        # Buscar lead associado
        lead_digits = normalize_phone_digits(phone)
        lead = find_matching_lead(db, lead_digits)

        summaries.append(ConversationSummary(
            phone=phone,
            lead_id=lead.id if lead else None,
            lead_name=lead.business_name if lead else last_msg.sender_name if last_msg else phone,
            lead_niche=lead.niche if lead else None,
            lead_crm_status=lead.crm_status if lead else None,
            unread_count=unread,
            last_message=last_msg.content if last_msg else None,
            last_message_at=last_msg.created_at if last_msg else None,
            last_message_direction=last_msg.direction if last_msg else None
        ))

    # Ordenar conversas pela mensagem mais recente
    summaries.sort(key=lambda c: c.last_message_at or datetime.min, reverse=True)
    return summaries

@router.get("/messages/{phone}", response_model=List[ChatMessageResponse])
def get_messages(phone: str, db: Session = Depends(get_db)):
    """Retorna o histórico de mensagens de um telefone."""
    clean_digits = re.sub(r"\D", "", phone)
    last_8 = clean_digits[-8:] if len(clean_digits) >= 8 else clean_digits

    # Busca mensagens por match exato ou pelos últimos 8 dígitos
    messages = db.query(ChatMessage).filter(
        or_(
            ChatMessage.phone == phone,
            ChatMessage.phone == clean_digits,
            ChatMessage.phone.like(f"%{last_8}")
        )
    ).order_by(ChatMessage.created_at.asc()).all()

    return messages

@router.post("/mark-read/{phone}")
async def mark_messages_as_read(phone: str, db: Session = Depends(get_db)):
    """Marca todas as mensagens recebidas de um contato como lidas."""
    clean_digits = re.sub(r"\D", "", phone)
    last_8 = clean_digits[-8:] if len(clean_digits) >= 8 else clean_digits

    messages = db.query(ChatMessage).filter(
        or_(
            ChatMessage.phone == phone,
            ChatMessage.phone == clean_digits,
            ChatMessage.phone.like(f"%{last_8}")
        ),
        ChatMessage.direction == "incoming",
        ChatMessage.is_read == False
    ).all()

    for msg in messages:
        msg.is_read = True
    db.commit()

    # Notificar via WebSocket
    await manager.broadcast({
        "type": "read_receipt",
        "phone": phone
    })

    return {"success": True, "marked_count": len(messages)}

@router.post("/send", response_model=ChatMessageResponse)
async def send_whatsapp_message(payload: SendMessageRequest, db: Session = Depends(get_db)):
    """Envia uma mensagem de texto via WhatsApp e salva no histórico."""
    clean_digits = re.sub(r"\D", "", payload.phone)
    if not clean_digits.startswith("55") and len(clean_digits) <= 11:
        clean_digits = "55" + clean_digits

    # 1. Enviar para o microserviço Baileys
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.post(
                f"{WHATSAPP_SERVICE_URL}/send",
                json={"phone": clean_digits, "text": payload.text}
            )
            if res.status_code != 200:
                err_detail = res.json().get("error", "Erro ao despachar mensagem pelo WhatsApp")
                raise HTTPException(status_code=400, detail=err_detail)
            data = res.json()
            message_id = data.get("messageId")
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=503,
            detail=f"Não foi possível conectar ao serviço WhatsApp na porta 3001. Verifique se ele está ativo."
        )

    # 2. Identificar lead associado
    lead = None
    if payload.lead_id:
        lead = db.query(Lead).filter(Lead.id == payload.lead_id).first()
    if not lead:
        lead = find_matching_lead(db, normalize_phone_digits(clean_digits))

    # Atualizar status CRM do lead se estiver no estágio 'new'
    if lead and lead.crm_status == "new":
        lead.crm_status = "contacted"
        lead.updated_at = datetime.utcnow()

    # 3. Salvar no banco de dados
    chat_msg = ChatMessage(
        lead_id=lead.id if lead else None,
        phone=clean_digits,
        direction="outgoing",
        sender_name="Você",
        content=payload.text,
        status="sent",
        is_read=True,
        whatsapp_message_id=message_id,
        created_at=datetime.utcnow()
    )
    db.add(chat_msg)
    db.commit()
    db.refresh(chat_msg)

    # 4. Notificar clientes conectados via WebSocket
    await manager.broadcast({
        "type": "new_message",
        "message": {
            "id": chat_msg.id,
            "lead_id": chat_msg.lead_id,
            "phone": chat_msg.phone,
            "direction": chat_msg.direction,
            "sender_name": chat_msg.sender_name,
            "content": chat_msg.content,
            "status": chat_msg.status,
            "is_read": chat_msg.is_read,
            "whatsapp_message_id": chat_msg.whatsapp_message_id,
            "created_at": chat_msg.created_at.isoformat()
        }
    })

    return chat_msg

@router.post("/webhook")
async def whatsapp_webhook(payload: WebhookPayload, db: Session = Depends(get_db)):
    """Recebe notificações de mensagens do microserviço Baileys."""
    clean_digits = re.sub(r"\D", "", payload.phone)

    # Buscar lead correspondente
    lead = find_matching_lead(db, normalize_phone_digits(clean_digits))

    # Se for mensagem recebida do cliente, avançar automaticamente para 'in_conversation'
    if lead and payload.direction == "incoming" and lead.crm_status in ("new", "contacted"):
        lead.crm_status = "in_conversation"
        lead.updated_at = datetime.utcnow()

    chat_msg = ChatMessage(
        lead_id=lead.id if lead else None,
        phone=clean_digits,
        direction=payload.direction,
        sender_name=payload.sender_name or (lead.business_name if lead else "Cliente"),
        content=payload.content,
        status=payload.status,
        is_read=True if payload.direction == "outgoing" else False,
        whatsapp_message_id=payload.whatsapp_message_id,
        created_at=datetime.utcnow()
    )
    db.add(chat_msg)
    db.commit()
    db.refresh(chat_msg)

    # Broadcast via WebSocket
    await manager.broadcast({
        "type": "new_message",
        "message": {
            "id": chat_msg.id,
            "lead_id": chat_msg.lead_id,
            "phone": chat_msg.phone,
            "direction": chat_msg.direction,
            "sender_name": chat_msg.sender_name,
            "content": chat_msg.content,
            "status": chat_msg.status,
            "is_read": chat_msg.is_read,
            "whatsapp_message_id": chat_msg.whatsapp_message_id,
            "created_at": chat_msg.created_at.isoformat()
        }
    })

    return {"success": True, "message_id": chat_msg.id}

# ==========================================
# WebSocket Endpoint para o Frontend
# ==========================================
@router.websocket("/ws")
async def whatsapp_websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Mantém conexão viva aguardando pings do cliente
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)
