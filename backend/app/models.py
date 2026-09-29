import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, Boolean, JSON, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base

def generate_uuid():
    return str(uuid.uuid4())

class Search(Base):
    __tablename__ = "searches"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    query = Column(String(255), nullable=False)
    niche = Column(String(100), nullable=False)
    location = Column(String(150), nullable=False)
    total_found = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    leads = relationship("Lead", back_populates="search", cascade="all, delete-orphan")

class Lead(Base):
    __tablename__ = "leads"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    search_id = Column(String(36), ForeignKey("searches.id"), nullable=True)
    business_name = Column(String(255), nullable=False)
    niche = Column(String(100), nullable=False)
    address = Column(String(255), nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(50), nullable=True)
    phone = Column(String(50), nullable=True)
    phone_type = Column(String(20), default="unknown")  # 'mobile', 'landline', 'unknown'
    website = Column(String(500), nullable=True)
    website_status = Column(String(30), default="none")  # 'none', 'social_media', 'insecure', 'outdated', 'healthy'
    rating = Column(Float, default=0.0)
    review_count = Column(Integer, default=0)
    has_recent_activity = Column(Boolean, default=False)
    source = Column(String(30), nullable=False, default="local_scraper")  # 'google_places_api', 'local_scraper'
    lead_score = Column(Integer, default=0)  # 0 to 100
    score_tier = Column(String(20), default="cold")  # 'hot', 'warm', 'cold'
    score_breakdown = Column(JSON, nullable=True)
    crm_status = Column(String(30), default="new")  # 'new', 'contacted', 'in_conversation', 'proposal_sent', 'won', 'lost'
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    search = relationship("Search", back_populates="leads")
    audits = relationship("SiteAudit", back_populates="lead", cascade="all, delete-orphan")

class SiteAudit(Base):
    __tablename__ = "site_audits"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    lead_id = Column(String(36), ForeignKey("leads.id"), nullable=False)
    url_tested = Column(String(500), nullable=True)
    is_accessible = Column(Boolean, default=False)
    is_https = Column(Boolean, default=False)
    is_mobile_responsive = Column(Boolean, default=False)
    response_time_ms = Column(Integer, default=0)
    redirects_to_social = Column(Boolean, default=False)
    social_network = Column(String(50), nullable=True)
    audited_at = Column(DateTime, default=datetime.utcnow)

    lead = relationship("Lead", back_populates="audits")
