"""Configuration de l'application"""
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """Paramètres de configuration de l'application"""
    
    # Database
    DATABASE_URL: str = "postgresql://websig_user:websig_pass@localhost:5432/websig_db"
    
    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://127.0.0.1:5500",  # Live Server VSCode
    ]
    
    # Application
    APP_NAME: str = "WebSIG Portfolio"
    DEBUG: bool = True
    
    # Fichiers
    UPLOAD_DIR: str = "./data/uploads"
    LIDAR_DIR: str = "./data/lidar"
    MAX_UPLOAD_SIZE: int = 100 * 1024 * 1024  # 100 MB
    
    # Sécurité (à changer en production !)
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
