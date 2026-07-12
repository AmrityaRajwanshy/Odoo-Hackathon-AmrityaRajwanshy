import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

# Load the environmental variables from the .env file
load_dotenv()

class Settings(BaseSettings):
    PROJECT_NAME: str = "AssetFlow ERP"
    PROJECT_VERSION: str = "1.0.0"
    
    # Read the connection string from your .env file
    DATABASE_URL: str = os.getenv("DATABASE_URL", "mysql+pymysql://root:password@localhost:3306/assetflow_db")
    
    # Security Configurations (Required later for Token Authentication)
    SECRET_KEY: str = os.getenv("SECRET_KEY", "super_secret_signing_key_change_me_in_production")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

# Instantiate the settings object to import across modules
settings = Settings()