from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

# Search Schemas
class SearchRequest(BaseModel):
    niche: str = Field(..., description="Ex: Clínica Odontológica, Restaurante, Academia")
    location: str = Field(..., description="Ex: Curitiba, PR ou Jardins, São Paulo")
    limit: int = Field(default=20, ge=1, le=100, description="Quantidade de resultados desejados")
    google_api_key: Optional[str] = Field(None, description="API Key opcional do Google Places")
    deep_audit: bool = Field(default=True, description="Auditar sites das empresas encontradas")

class SearchResponse(BaseModel):
    id: str
    query: str
    niche: str
    location: str
    total_found: int
    created_at: datetime

    class Config:
        from_attributes = True

# Site Audit Schemas
class SiteAuditResponse(BaseModel):
    id: str
    lead_id: str
    url_tested: Optional[str] = None
    is_accessible: bool
    is_https: bool
    is_mobile_responsive: bool
    response_time_ms: int
    redirects_to_social: bool
    social_network: Optional[str] = None
    audited_at: datetime

    class Config:
        from_attributes = True

# Lead Schemas
class LeadResponse(BaseModel):
    id: str
    search_id: Optional[str] = None
    business_name: str
    niche: str
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    phone: Optional[str] = None
    phone_type: str
    website: Optional[str] = None
    website_status: str
    rating: float
    review_count: int
    has_recent_activity: bool
    source: str
    lead_score: int
    score_tier: str
    score_breakdown: Optional[Dict[str, Any]] = None
    crm_status: str
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    audits: List[SiteAuditResponse] = []

    class Config:
        from_attributes = True

class LeadUpdateStatus(BaseModel):
    crm_status: str = Field(..., description="new, contacted, in_conversation, proposal_sent, won, lost")

class LeadUpdateNotes(BaseModel):
    notes: str

# Pitch Schemas
class PitchResponse(BaseModel):
    lead_id: str
    business_name: str
    phone: Optional[str] = None
    whatsapp_url: Optional[str] = None
    pitch_text: str
    scenario: str
