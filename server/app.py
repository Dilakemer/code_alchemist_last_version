import os
import sys
import json
import time
import random
import smtplib
import resend
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import timedelta, datetime
from dotenv import load_dotenv
from flask import Flask, request, jsonify, Response, stream_with_context
from flask_cors import CORS
from flask_jwt_extended import (
    JWTManager, create_access_token, get_jwt_identity, jwt_required, verify_jwt_in_request
)
from passlib.hash import pbkdf2_sha256
from google import generativeai as genai
from models import db, History, Answer, User, Conversation, Snippet, PasswordResetToken, UserFollow, Notification, Favorite
from anthropic import Anthropic, APIError
from openai import OpenAI

# Load environment variables
basedir = os.path.abspath(os.path.dirname(__file__))
env_path = os.path.join(basedir, '.env')

# Load .env file
load_dotenv(env_path, override=True, encoding='utf-8')

# Fallback: manually read .env if GEMINI_API_KEY is still not set
if not os.getenv('GEMINI_API_KEY'):
    try:
        with open(env_path, 'r', encoding='utf-8-sig') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, _, value = line.partition('=')
                    key = key.strip()
                    value = value.strip()
                    if key and value:
                        os.environ[key] = value
    except Exception:
        pass  # Silent fail - will be handled by API key checks later


app = Flask(__name__)
basedir = os.path.abspath(os.path.dirname(__file__))
# Veritabanı dosyasını instance klasöründe tutuyoruz (Flask standardı)
instance_path = os.path.join(basedir, 'instance')
if not os.path.exists(instance_path):
    os.makedirs(instance_path, exist_ok=True)

db_path = os.path.join(instance_path, 'codebrain.db')
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + db_path
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
# JWT Security: Require strong secret key in production
_jwt_secret = os.getenv('JWT_SECRET_KEY')
if not _jwt_secret or _jwt_secret == 'dev-secret-key':
    import secrets
    _jwt_secret = secrets.token_hex(32)
    print("WARNING: JWT_SECRET_KEY not set or using default. Generated temporary key. Set a strong JWT_SECRET_KEY in .env for production!")
app.config['JWT_SECRET_KEY'] = _jwt_secret
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=6)
app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB limit

if not os.path.exists(app.config['UPLOAD_FOLDER']):
    os.makedirs(app.config['UPLOAD_FOLDER'])

from werkzeug.utils import secure_filename
from flask import send_from_directory
import base64
import mimetypes

CORS(app)
db.init_app(app)
jwt = JWTManager(app)

# Veritabanı tablolarını otomatik oluştur (Render Deployment Fix)
try:
    with app.app_context():
        db.create_all()
        print("✅ Database tables created successfully.")
except Exception as e:
    print(f"⚠️ Initial database creation check failed: {e}")

@jwt.invalid_token_loader
def invalid_token_callback(error):
    print(f"JWT Invalid: {error}")
    return jsonify({'error': f'Invalid token: {error}'}), 422

@jwt.unauthorized_loader
def missing_token_callback(error):
    print(f"JWT Missing: {error}")
    return jsonify({'error': f'Missing token: {error}'}), 401

@jwt.expired_token_loader
def expired_token_callback(jwt_header, jwt_payload):
    print(f"JWT Expired: {jwt_payload}")
    return jsonify({'error': 'Token expired'}), 401

# --- 1. GEMINI KONFIGURASYONU ---
# Varsayılan model olarak 2.5 Flash'ı seçtik (yeni standart)
GEMINI_MODEL = os.getenv('GEMINI_MODEL_NAME', 'models/gemini-2.5-flash')
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
else:
    print("Warning: GEMINI_API_KEY not defined. Gemini calls disabled.")

# --- 2. CLAUDE KONFIGURASYONU ---
# Varsayılan model olarak hızlı ve zeki olan Sonnet 4.5'i seçtik
ANTHROPIC_MODEL = os.getenv('CLAUDE_MODEL_NAME', 'claude-3-5-sonnet-20241022')
ANTHROPIC_API_KEY = os.getenv('ANTHROPIC_API_KEY')

claude_client = None
if ANTHROPIC_API_KEY:
    try:
        claude_client = Anthropic(api_key=ANTHROPIC_API_KEY)
    except Exception as e:
        print(f"Warning: Failed to initialize Anthropic client: {e}")
else:
    print("Warning: ANTHROPIC_API_KEY not defined. Claude calls disabled.")

# --- 3. OPENAI (GPT) KONFIGURASYONU ---
OPENAI_MODEL = os.getenv('OPENAI_MODEL_NAME', 'gpt-4o')
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')


openai_client = None
openai_init_error = None

if OPENAI_API_KEY:
    try:
        openai_client = OpenAI(api_key=OPENAI_API_KEY)
        print("OpenAI client initialized successfully.")
    except Exception as e:
        openai_init_error = str(e)
        print(f"Warning: Failed to initialize OpenAI client: {e}")
else:
    print("Warning: OPENAI_API_KEY not defined. GPT calls disabled.")


# --- MODEL FONKSİYONLARI ---

# --- YARDIMCI FONKSİYONLAR ---
def transcribe_audio_with_gemini(audio_path):
    """Gemini kullanarak ses dosyasını metne çevirir."""
    try:
        if not GEMINI_API_KEY:
            return None
            
        import google.generativeai as genai
        import mimetypes
        
        mime_type, _ = mimetypes.guess_type(audio_path)
        # Fallback mime types
        if not mime_type:
            ext = os.path.splitext(audio_path)[1].lower()
            if ext == '.mp3': mime_type = 'audio/mpeg'
            elif ext == '.wav': mime_type = 'audio/wav'
            elif ext == '.m4a': mime_type = 'audio/mp4'
            elif ext == '.webm': mime_type = 'audio/webm'
            else: mime_type = 'audio/mp3'

        model = genai.GenerativeModel("gemini-2.0-flash")
        
        with open(audio_path, 'rb') as audio_file:
            audio_bytes = audio_file.read()
            
        # SDK supports dictionary for inline data
        audio_part = {
            "mime_type": mime_type,
            "data": audio_bytes
        }
        
        response = model.generate_content([
            audio_part, 
            "Please transcribe this audio exactly as it is spoken. Do not add any commentary. Just return the text."
        ])
        
        if response and response.text:
            return response.text.strip()
        return None
    except Exception as e:
        print(f"Transcription error: {e}")
        return None

def generate_image_with_dalle(prompt):
    """OpenAI DALL-E 3 kullanarak resim oluşturur."""
    if not openai_client:
        return "Error: OpenAI API key not found."
    
    try:
        print(f"Generating image for prompt: {prompt}")
        response = openai_client.images.generate(
            model="dall-e-3",
            prompt=prompt,
            size="1024x1024",
            quality="standard",
            n=1,
        )
        
        image_url = response.data[0].url
        
        # Resmi indirip yerel olarak kaydet (URL'lerin süresi doluyor)
        import requests
        from datetime import datetime
        
        img_data = requests.get(image_url).content
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"generated_{timestamp}.png"
        
        # Klasör yoksa oluştur
        save_dir = os.path.join(app.root_path, 'static', 'generated')
        os.makedirs(save_dir, exist_ok=True)
        
        save_path = os.path.join(save_dir, filename)
        
        with open(save_path, 'wb') as handler:
            handler.write(img_data)
            
        # Frontend için erişilebilir URL döndür
        base_url = request.host_url.rstrip('/')
        local_url = f"{base_url}/static/generated/{filename}"
        return f"![Generated Image]({local_url})\n\n**Generated for:** *{prompt}*"
        
    except Exception as e:
        print(f"DALL-E Error: {e}")
        return f"Sorry, I couldn't generate the image. Error: {str(e)}"

def generate_gemini_answer(question: str, code: str, history_context: list = None, requested_model: str = None, image_path: str = None, prefs: dict = None):
    """Gemini API çağrısı yapar. Sadece seçilen modeli kullanır."""
    if not GEMINI_API_KEY:
        yield "Error: GEMINI_API_KEY missing."
        return

    # User Preferences: Style Prompt
    style_prompt = ""
    if prefs:
        if prefs.get('response_style') == 'concise':
            style_prompt = "Keep your answers very concise and short. "
        elif prefs.get('response_style') == 'detailed':
            style_prompt = "Provide detailed and comprehensive explanations. "

    # User Persona info
    persona_info = ""
    if prefs:
        persona = prefs.get('persona', 'General User')
        expertise = prefs.get('expertise', 'Intermediate')
        interests = ", ".join(prefs.get('interests', []))
        persona_info = f"User Profile: {persona} (Expertise: {expertise}). "
        if interests:
            persona_info += f"User is interested in: {interests}. "

    # Model Seçimi
    if requested_model and ('gemini' in requested_model or 'gemma' in requested_model):
        model_mapping = {
            'gemma-3-27b': 'gemini-1.5-flash',
            'gemma-2-27b-it': 'gemini-1.5-flash',
            'gemma-2-9b-it': 'gemini-1.5-flash',
            'gemini-3-flash': 'gemini-3-flash-preview',
            'gemini-2.5-flash': 'gemini-2.5-flash',
            'gemini-2.5-flash-lite': 'gemini-2.5-flash-lite',
            'gemini-2.5-pro': 'gemini-2.5-pro',
            'gemini-1.5-flash': 'gemini-1.5-flash',
            'gemini-1.5-pro': 'gemini-1.5-pro',
            'gemini-1.5-flash-8b': 'gemini-1.5-flash-8b'
        }
        
        target_id = model_mapping.get(requested_model, requested_model)
        
        # Fallback Zinciri Hazırla
        fallback_chain = []
        
        # 1. Hedef modeli ekle
        fallback_chain.append(target_id)
        
        # 2. Eğer hedef model "lite" değilse, sırasıyla güçlüden zayıfa alternatif ekle
        if 'lite' not in target_id:
            # Önce 2.5 Flash (Yüksek kota, çok hızlı)
            fallback_chain.append('gemini-2.5-flash')
            # 2.5 Flash Lite (En yüksek kota)
            fallback_chain.append('gemini-2.5-flash-lite') 
            # 2.0 Flash
            fallback_chain.append('gemini-2.0-flash')
            # 1.5 Flash (Geniş kota)
            fallback_chain.append('gemini-1.5-flash')
            
        # Ensure 1.5 Flash is always at the end of fallback as a reliable alternative
        if 'gemini-1.5-flash' not in fallback_chain:
             fallback_chain.append('gemini-1.5-flash')

        print(f"--- Model Zinciri: {fallback_chain} ---")

    else:
        # Varsayılan (Fallback zinciri ile)
        fallback_chain = [GEMINI_MODEL, 'gemini-1.5-flash']

    prompt_parts = [
        "You are a helpful AI assistant. Communicate with the user in a natural conversation style. "
        f"{persona_info}"
        f"{style_prompt}"
        "If the user asks a question about code, software, or a technical topic, "
        "provide detailed technical assistance and give code examples if necessary. "
        "IMPORTANT: Always respond in the same language as the user's question (e.g., if the question is in Turkish, respond in Turkish)."
        "CRITICAL: You CANNOT generate images directly. DO NOT output markdown image links (e.g. ![](/static/...)) unless the system has provided them. If the user asks for an image and you are responding as text, explain that you are a text model or ask them to be more specific to trigger the image generator.",
    ]

    if history_context:
        filtered_history = []
        for turn in history_context:
            u_text = turn.get('user', '').strip()
            a_text = turn.get('ai', '').strip()
            if u_text or a_text:
                filtered_history.append((u_text, a_text))
        
        if filtered_history:
            prompt_parts.append("--- Previous Conversation ---")
            for u_text, a_text in filtered_history:
                if u_text: prompt_parts.append(f"User: {u_text}")
                if a_text: prompt_parts.append(f"Assistant: {a_text}")
            prompt_parts.append("--- New Message ---")

    prompt_parts.append(f"User: {question.strip() or 'Hello'}")

    if code and code.strip():
        prompt_parts.append("Related Code:\n```\n" + code.strip() + "\n```")
    
    if image_path:
        # Dosya uzantısını kontrol et
        file_ext = os.path.splitext(image_path)[1].lower()
        text_extensions = ['.txt', '.py', '.js', '.jsx', '.ts', '.tsx', '.json', '.md', '.csv', 
                          '.html', '.css', '.xml', '.yaml', '.yml', '.log', '.sql', '.sh', 
                          '.bat', '.ps1', '.c', '.cpp', '.h', '.java', '.rb', '.go', '.rs', 
                          '.php', '.swift', '.kt', '.r', '.m']
        
        if file_ext in text_extensions:
            # Metin dosyası - içeriği oku ve prompt'a ekle
            try:
                with open(image_path, 'r', encoding='utf-8', errors='ignore') as f:
                    file_content = f.read()
                file_name = os.path.basename(image_path)
                prompt_parts.append(f"\n--- Uploaded File: {file_name} ---\n```\n{file_content}\n```\n")
                prompt_parts.append("Analyze the uploaded file content and answer the user's question about it.")
                print(f"Text file read successfully: {file_name} ({len(file_content)} chars)")
            except Exception as e:
                print(f"Text file read error: {e}")
        
        elif file_ext == '.pdf':
            # PDF dosyası - pypdf ile oku
            try:
                from pypdf import PdfReader
                reader = PdfReader(image_path)
                pdf_text = ""
                for page in reader.pages:
                    pdf_text += page.extract_text() or ""
                file_name = os.path.basename(image_path)
                prompt_parts.append(f"\n--- Uploaded PDF: {file_name} ---\n{pdf_text[:10000]}\n")  # İlk 10K karakter
                prompt_parts.append("Analyze the uploaded PDF content and answer the user's question about it.")
                print(f"PDF file read successfully: {file_name} ({len(pdf_text)} chars)")
            except Exception as e:
                print(f"PDF read error: {e}")
        
        elif file_ext in ['.doc', '.docx']:
            # Word dosyası - python-docx ile oku
            try:
                from docx import Document
                doc = Document(image_path)
                doc_text = "\n".join([para.text for para in doc.paragraphs])
                file_name = os.path.basename(image_path)
                prompt_parts.append(f"\n--- Uploaded Word Document: {file_name} ---\n{doc_text[:10000]}\n")  # İlk 10K karakter
                prompt_parts.append("Analyze the uploaded Word document content and answer the user's question about it.")
                print(f"Word file read successfully: {file_name} ({len(doc_text)} chars)")
            except Exception as e:
                print(f"Word read error: {e}")
        
        else:
            # Resim veya Ses dosyası - Gemini için Part nesnesi kullan
            try:
                import PIL.Image
                import base64
                import mimetypes
                
                # MIME type'ı tespit et
                mime_type, _ = mimetypes.guess_type(image_path)
                
                # Ses dosyası kontrolü
                audio_extensions = ['.mp3', '.wav', '.webm', '.m4a', '.ogg', '.aac', '.flac']
                if any(file_ext == ext for ext in audio_extensions):
                    if not mime_type or not mime_type.startswith('audio/'):
                        if file_ext == '.webm': mime_type = 'audio/webm'
                        elif file_ext == '.mp3': mime_type = 'audio/mpeg'
                        elif file_ext == '.wav': mime_type = 'audio/wav'
                        elif file_ext == '.m4a': mime_type = 'audio/mp4'
                        elif file_ext == '.ogg': mime_type = 'audio/ogg'
                        elif file_ext == '.aac': mime_type = 'audio/aac'
                        elif file_ext == '.flac': mime_type = 'audio/flac'
                    
                    print(f"Audio processing: {image_path} ({mime_type})")
                    
                    with open(image_path, 'rb') as audio_file:
                        audio_bytes = audio_file.read()
                    
                    print(f"Audio file size: {len(audio_bytes)} bytes")
                    
                    # SDK dictionary format
                    audio_part = {
                        "mime_type": mime_type,
                        "data": audio_bytes
                    }
                    prompt_parts.append(audio_part)
                    
                    # Eğer kullanıcı metin yazmadıysa, ses mesajı için özel talimat ekle
                    if not question.strip() or question.strip() == 'Hello':
                        prompt_parts.append(
                            "The user has sent a voice message. Please:\n"
                            "1. First, transcribe what the user said in the audio.\n"
                            "2. Then, respond to their message/question appropriately.\n"
                            "Format your response as:\n"
                            "**You said:** [transcription]\n\n"
                            "[Your response to their message]"
                        )
                    else:
                        prompt_parts.append(
                            "The user has sent a voice message along with their text. "
                            "Listen to the audio and consider both the audio content and the written text when responding."
                        )
                    print("Audio part added to prompt successfully")
                    
                else:
                    # Resim (Default fallback)
                    if not mime_type or not mime_type.startswith('image/'):
                        mime_type = 'image/jpeg'  # Varsayılan
                    
                    # Resmi base64'e çevir
                    with open(image_path, 'rb') as img_file:
                        image_bytes = img_file.read()
                    
                    # SDK dictionary format
                    image_part = {
                        "mime_type": mime_type,
                        "data": image_bytes
                    }
                    
                    prompt_parts.append(image_part)
                    prompt_parts.append("Answer the question related to this image.")
                    print(f"Image added successfully: {os.path.basename(image_path)} ({mime_type})")

            except Exception as e:
                print(f"Media upload error: {e}")
                import traceback
                traceback.print_exc()
                yield f"Error processing media file: {str(e)}"
                return

    # Sadece kod varsa veya teknik soru gibiyse maddeler halinde yanıtla
    if code and code.strip():
        prompt_parts.append("Answer in bullet points and support with example code.")
    
    # Fallback Zinciri Üzerinde Dön
    model_success = False
    
    for model_name in fallback_chain:
        current_model_id = f"models/{model_name}" if not model_name.startswith("models/") else model_name
        
        try:
            print(f"Gemini Deneniyor: {current_model_id}")
            model = genai.GenerativeModel(current_model_id)
            
            if model_name != fallback_chain[0]:
                yield f"\n\n*> [System]: Previous model failed, trying **{model_name}**...*\n\n"

            response = model.generate_content(prompt_parts, stream=True)
            
            for chunk in response:
                if chunk.text:
                    yield chunk.text
            
            model_success = True
            break # Başarılı olduysa döngüden çık

        except Exception as exc:
            error_str = str(exc)
            
            # Hata Analizi
            is_quota = "429" in error_str or "TooManyRequests" in error_str or "quota" in error_str.lower()
            is_not_found = "404" in error_str or "NotFound" in error_str
            
            if is_quota or is_not_found or "503" in error_str:
                print(f"Hata ({model_name}): {error_str} -> Sıradaki modele geçiliyor.")
                continue # Sonraki modele geç
            else:
                # Kritik ve bilinmeyen bir hata ise direkt bildir ve dur
                yield f"[Critical Error ({model_name})]: {exc}"
                return

    if not model_success:
        yield "\n\n[System Message]: Sorry, all alternative models failed but no response was received. (Quota exceeded or service unavailable)."


def generate_claude_answer(question: str, code: str, history_context: list = None, requested_model: str = None, image_path: str = None, prefs: dict = None):
    """Claude API çağrısı yapar (Streaming)."""
    if not claude_client:
        yield "Error: ANTHROPIC_API_KEY missing."
        return
    
    if requested_model and 'claude' in requested_model:
        target_model = requested_model
    else:
        target_model = ANTHROPIC_MODEL if ANTHROPIC_MODEL else 'claude-sonnet-4-5-20250929'

    print(f"Claude İsteği (Stream) şu modelle yapılıyor: {target_model}")

    style_prompt = ""
    if prefs:
        if prefs.get('response_style') == 'concise':
            style_prompt = "Keep your answers very concise and short. "
        elif prefs.get('response_style') == 'detailed':
            style_prompt = "Provide detailed and comprehensive explanations. "

    # User Persona info
    persona_info = ""
    if prefs:
        persona = prefs.get('persona', 'General User')
        expertise = prefs.get('expertise', 'Intermediate')
        interests = ", ".join(prefs.get('interests', []))
        persona_info = f"User Profile: {persona} (Expertise: {expertise}). "
        if interests:
            persona_info += f"User is interested in: {interests}. "

    system_prompt = (
        "You are a helpful AI assistant. Communicate with the user in a natural conversation style. "
        f"{persona_info}"
        f"{style_prompt}"
        "provide detailed technical assistance and give code examples if necessary (in Markdown code block). "
        "IMPORTANT: Always respond in the same language as the user's question (e.g., if the question is in Turkish, respond in Turkish)."
        "CRITICAL: You CANNOT generate images directly. DO NOT output markdown image links (e.g. ![](/static/...)). If the user asks for an image, explain that you are a text model."
    )

    user_message = f"Question: {question.strip() or 'Unspecified'}"
    if code and code.strip():
        user_message += "\n\nRelated Code:\n```\n" + code.strip() + "\n```"

    messages = []
    if history_context:
        for turn in history_context:
            u_text = turn.get('user', '').strip()
            a_text = turn.get('ai', '').strip()
            if u_text:
                messages.append({"role": "user", "content": u_text})
            if a_text:
                messages.append({"role": "assistant", "content": a_text})
    
    if image_path:
        # Dosya uzantısını kontrol et
        file_ext = os.path.splitext(image_path)[1].lower()
        text_extensions = ['.txt', '.py', '.js', '.jsx', '.ts', '.tsx', '.json', '.md', '.csv', 
                          '.html', '.css', '.xml', '.yaml', '.yml', '.log', '.sql', '.sh', 
                          '.bat', '.ps1', '.c', '.cpp', '.h', '.java', '.rb', '.go', '.rs', 
                          '.php', '.swift', '.kt', '.r', '.m']
        
        if file_ext in text_extensions:
            # Metin dosyası - içeriği oku ve mesaja ekle
            try:
                with open(image_path, 'r', encoding='utf-8', errors='ignore') as f:
                    file_content = f.read()
                file_name = os.path.basename(image_path)
                user_message += f"\n\n--- Uploaded File: {file_name} ---\n```\n{file_content}\n```\n"
                user_message += "\nAnalyze the uploaded file content and answer the user's question about it."
                messages.append({"role": "user", "content": user_message})
                print(f"Claude: Text file read successfully: {file_name} ({len(file_content)} chars)")
            except Exception as e:
                print(f"Claude: Text file read error: {e}")
                messages.append({"role": "user", "content": user_message})
        
        elif file_ext == '.pdf':
            # PDF dosyası - pypdf ile oku
            try:
                from pypdf import PdfReader
                reader = PdfReader(image_path)
                pdf_text = ""
                for page in reader.pages:
                    pdf_text += page.extract_text() or ""
                file_name = os.path.basename(image_path)
                user_message += f"\n\n--- Uploaded PDF: {file_name} ---\n{pdf_text[:10000]}\n"
                user_message += "\nAnalyze the uploaded PDF content and answer the user's question about it."
                messages.append({"role": "user", "content": user_message})
                print(f"Claude: PDF file read successfully: {file_name} ({len(pdf_text)} chars)")
            except Exception as e:
                print(f"Claude: PDF read error: {e}")
                messages.append({"role": "user", "content": user_message})
        
        elif file_ext in ['.doc', '.docx']:
            # Word dosyası - python-docx ile oku
            try:
                from docx import Document
                doc = Document(image_path)
                doc_text = "\n".join([para.text for para in doc.paragraphs])
                file_name = os.path.basename(image_path)
                user_message += f"\n\n--- Uploaded Word Document: {file_name} ---\n{doc_text[:10000]}\n"
                user_message += "\nAnalyze the uploaded Word document content and answer the user's question about it."
                messages.append({"role": "user", "content": user_message})
                print(f"Claude: Word file read successfully: {file_name} ({len(doc_text)} chars)")
            except Exception as e:
                print(f"Claude: Word read error: {e}")
                messages.append({"role": "user", "content": user_message})
        
        else:
            # Resim dosyası - mevcut mantık
            try:
                with open(image_path, "rb") as image_file:
                    encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
                    mime_type, _ = mimetypes.guess_type(image_path)
                    if not mime_type: mime_type = 'image/jpeg'
                    
                    messages.append({
                        "role": "user",
                        "content": [
                            {"type": "image", "source": {"type": "base64", "media_type": mime_type, "data": encoded_string}},
                            {"type": "text", "text": user_message}
                        ]
                    })
            except Exception as e:
                print(f"Claude image error: {e}")
                messages.append({"role": "user", "content": user_message})
    else:
        messages.append({"role": "user", "content": user_message})

    try:
        with claude_client.messages.stream(
            model=target_model,
            max_tokens=4096,
            system=system_prompt,
            messages=messages
        ) as stream:
            for text in stream.text_stream:
                yield text

    except Exception as exc:
        yield f"[Claude Error ({target_model})]: {exc}"


def generate_gpt_answer(question: str, code: str, history_context: list = None, requested_model: str = None, image_path: str = None, prefs: dict = None):
    """OpenAI GPT API'sini kullanarak cevap üretir (Streaming)."""
    if not openai_client:
        if openai_init_error:
            yield f"Error: OpenAI client init failed: {openai_init_error}"
        else:
            yield "Error: OPENAI_API_KEY missing."
        return

    if requested_model and 'gpt' in requested_model:
        target_model = requested_model
    else:
        target_model = OPENAI_MODEL

    # Model info logged without sensitive data
    print(f"GPT Request (Stream) with model: {target_model}")

    style_prompt = ""
    if prefs:
        if prefs.get('response_style') == 'concise':
            style_prompt = "Keep your answers very concise and short. "
        elif prefs.get('response_style') == 'detailed':
            style_prompt = "Provide detailed and comprehensive explanations. "

    # User Persona info
    persona_info = ""
    if prefs:
        persona = prefs.get('persona', 'General User')
        expertise = prefs.get('expertise', 'Intermediate')
        interests = ", ".join(prefs.get('interests', []))
        persona_info = f"User Profile: {persona} (Expertise: {expertise}). "
        if interests:
            persona_info += f"User is interested in: {interests}. "

    system_prompt = (
        "You are a helpful AI assistant. Communicate with the user in a natural conversation style. "
        f"{persona_info}"
        f"{style_prompt}"
        "If the user asks a question about code, software, or a technical topic, "
        "provide detailed technical assistance and give code examples if necessary (in Markdown code block). "
        "IMPORTANT: Always respond in the same language as the user's question (e.g., if the question is in Turkish, respond in Turkish)."
    )

    user_message = f"Question: {question.strip() or 'Unspecified'}"
    if code and code.strip():
        user_message += "\n\nRelated Code:\n```\n" + code.strip() + "\n```"

    messages = [{"role": "system", "content": system_prompt}]
    
    if history_context:
        for turn in history_context:
            u_text = turn.get('user', '').strip()
            a_text = turn.get('ai', '').strip()
            if u_text:
                messages.append({"role": "user", "content": u_text})
            if a_text:
                messages.append({"role": "assistant", "content": a_text})

    if image_path:
        # Dosya uzantısını kontrol et
        file_ext = os.path.splitext(image_path)[1].lower()
        text_extensions = ['.txt', '.py', '.js', '.jsx', '.ts', '.tsx', '.json', '.md', '.csv', 
                          '.html', '.css', '.xml', '.yaml', '.yml', '.log', '.sql', '.sh', 
                          '.bat', '.ps1', '.c', '.cpp', '.h', '.java', '.rb', '.go', '.rs', 
                          '.php', '.swift', '.kt', '.r', '.m']
        
        if file_ext in text_extensions:
            # Metin dosyası - içeriği oku ve mesaja ekle
            try:
                with open(image_path, 'r', encoding='utf-8', errors='ignore') as f:
                    file_content = f.read()
                file_name = os.path.basename(image_path)
                user_message += f"\n\n--- Uploaded File: {file_name} ---\n```\n{file_content}\n```\n"
                user_message += "\nAnalyze the uploaded file content and answer the user's question about it."
                messages.append({"role": "user", "content": user_message})
                print(f"GPT: Text file read successfully: {file_name} ({len(file_content)} chars)")
            except Exception as e:
                print(f"GPT: Text file read error: {e}")
                messages.append({"role": "user", "content": user_message})
        
        elif file_ext == '.pdf':
            # PDF dosyası - pypdf ile oku
            try:
                from pypdf import PdfReader
                reader = PdfReader(image_path)
                pdf_text = ""
                for page in reader.pages:
                    pdf_text += page.extract_text() or ""
                file_name = os.path.basename(image_path)
                user_message += f"\n\n--- Uploaded PDF: {file_name} ---\n{pdf_text[:10000]}\n"
                user_message += "\nAnalyze the uploaded PDF content and answer the user's question about it."
                messages.append({"role": "user", "content": user_message})
                print(f"GPT: PDF file read successfully: {file_name} ({len(pdf_text)} chars)")
            except Exception as e:
                print(f"GPT: PDF read error: {e}")
                messages.append({"role": "user", "content": user_message})
        
        elif file_ext in ['.doc', '.docx']:
            # Word dosyası - python-docx ile oku
            try:
                from docx import Document
                doc = Document(image_path)
                doc_text = "\n".join([para.text for para in doc.paragraphs])
                file_name = os.path.basename(image_path)
                user_message += f"\n\n--- Uploaded Word Document: {file_name} ---\n{doc_text[:10000]}\n"
                user_message += "\nAnalyze the uploaded Word document content and answer the user's question about it."
                messages.append({"role": "user", "content": user_message})
                print(f"GPT: Word file read successfully: {file_name} ({len(doc_text)} chars)")
            except Exception as e:
                print(f"GPT: Word read error: {e}")
                messages.append({"role": "user", "content": user_message})
        
        else:
            # Resim dosyası - mevcut mantık
            try:
                with open(image_path, "rb") as image_file:
                    encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
                    mime_type, _ = mimetypes.guess_type(image_path)
                    if not mime_type: mime_type = 'image/jpeg'

                    messages.append({
                        "role": "user",
                        "content": [
                            {"type": "text", "text": user_message},
                            {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{encoded_string}"}}
                        ]
                    })
            except Exception as e:
                print(f"GPT image error: {e}")
                messages.append({"role": "user", "content": user_message})
    else:
        messages.append({"role": "user", "content": user_message})

    try:
        stream = openai_client.chat.completions.create(
            model=target_model, 
            messages=messages,
            temperature=0.7,
            max_tokens=2000,
            stream=True
        )
        for chunk in stream:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    except Exception as e:
        yield f"[OpenAI Error]: {e}"


def generate_conversation_title(question: str, answer: str = None) -> str:
    """Sohbet için kısa ve öz bir başlık üretir."""
    if not question:
        return "New Chat"
    
    # Önce basit bir başlık oluştur (ilk 40 karakter)
    simple_title = question.strip()[:40]
    if len(question) > 40:
        simple_title += "..."
    
    # Gemini ile daha iyi başlık üretmeyi dene
    if GEMINI_API_KEY:
        try:
            title_prompt = (
                "Write a very short title summarizing this question (max 5-6 words). "
                "Respond in the same language as the question. "
                "Only write the title, do not add anything else:\n\n"
                f"Question: {question[:200]}"
            )
            
            # Önce 2.5 Flash Lite (Yüksek kota), sonra 2.0 Flash, son çare 1.5 Flash 8B
            for model_name in ['models/gemini-2.5-flash-lite', 'models/gemini-2.0-flash', 'models/gemini-1.5-flash-8b']:
                try:
                    model = genai.GenerativeModel(model_name)
                    result = model.generate_content(title_prompt)
                    title_text = getattr(result, "text", "").strip()
                    if title_text:
                        # Başlığı temizle (fazla uzunsa kısalt)
                        title_text = title_text.replace('"', '').replace("'", "").strip()
                        return title_text[:50] if len(title_text) > 50 else title_text
                except Exception as e:
                    print(f"Başlık üretimi hatası ({model_name}): {e}")
                    continue
        except Exception as exc:
            print(f"Başlık üretimi genel hatası: {exc}")
    
    return simple_title


def summarize_answer(answer: str) -> str:
    if not answer:
        return ""

    # Özetleme için Gemini kullanıyoruz. 2.0 Flash daha yüksek ücretsiz limitlere sahip.
    if GEMINI_API_KEY:
        try:
            summary_prompt = (
                "Summarize the following response in at most three bullet points. "
                "Give short and actionable tips:\n\n"
                f"{answer[:2000]}"  # Token tasarrufu için sınırla
            )
            
            # Öncelik sırası: 2.5 Flash Lite > 2.0 Flash > 1.5 Flash 8B
            for model_name in ['models/gemini-2.5-flash-lite', 'models/gemini-2.0-flash', 'models/gemini-1.5-flash-8b']:
                try:
                    model = genai.GenerativeModel(model_name)
                    # Timeout ekle: 10 saniye içinde özetlemezse geç
                    summary_result = model.generate_content(summary_prompt, request_options={'timeout': 10000})
                    summary_text = getattr(summary_result, "text", "")
                    if summary_text:
                        return summary_text.strip()
                except Exception as e:
                    print(f"Özetleme hatası ({model_name}): {e}")
                    continue
        except Exception as exc:
            print(f"Özetleme genel hatası: {exc}")

    return answer[:240] + ("..." if len(answer) > 240 else "")


def get_user_preferences(user):
    """Kullanıcının AI Taste Profile bilgilerini JSON olarak döner."""
    if not user or not user.preferences:
        return {
            "preferred_model": "auto",
            "response_style": "balanced",
            "fav_language": "natural",
            "usage_stats": {"claude": 0, "gemini": 0, "gpt": 0},
            "persona": "General User",
            "expertise": "Mid-level",
            "interests": []
        }
    try:
        return json.loads(user.preferences)
    except:
        return {
            "preferred_model": "auto",
            "response_style": "balanced",
            "fav_language": "natural",
            "usage_stats": {"claude": 0, "gemini": 0, "gpt": 0},
            "persona": "General User",
            "expertise": "Mid-level",
            "interests": []
        }

def update_user_taste(user, model_used, answer_text, user_question=""):
    """Kullanıcının tercihlerini ve personasını analiz ederek otomatik günceller."""
    if not user:
        return
    
    # DetachedInstanceError fix: Re-fetch or merge user in the current session
    try:
        user = db.session.merge(user)
    except Exception as e:
        print(f"User merge error: {e}")
        return

    prefs = get_user_preferences(user)
    
    # 1. Model kullanımını takip et
    if 'usage_stats' not in prefs:
        prefs['usage_stats'] = {"claude": 0, "gemini": 0, "gpt": 0}
    
    model_type = "gemini"
    if "claude" in model_used.lower(): model_type = "claude"
    elif "gpt" in model_used.lower(): model_type = "gpt"
    
    prefs['usage_stats'][model_type] = prefs['usage_stats'].get(model_type, 0) + 1
    
    # En çok kullanılan modeli tespit et
    max_usage = 0
    best_model = prefs.get('preferred_model', 'auto')
    for m, count in prefs['usage_stats'].items():
        if count > max_usage:
            max_usage = count
            best_model = m
            
    if max_usage >= 3: # En az 3 kullanımdan sonra tercihi güncellemeye başla
        prefs['preferred_model'] = best_model
        
    # Yanıt tarzını analiz et (kısa/uzun)
    if answer_text:
        char_count = len(answer_text)
        current_style = prefs.get('response_style', 'balanced')
        
        if char_count < 400:
            if current_style == 'balanced': prefs['response_style'] = 'concise'
            elif current_style == 'detailed': prefs['response_style'] = 'balanced'
        elif char_count > 1500:
            if current_style == 'balanced': prefs['response_style'] = 'detailed'
            elif current_style == 'concise': prefs['response_style'] = 'balanced'

    # 3. Persona Analizi (Gemini ile derin analiz)
    if user_question and GEMINI_API_KEY:
        try:
            # Sadece her 5 mesajda bir veya persona yoksa analiz yap (Token tasarrufu)
            total_usage = sum(prefs.get('usage_stats', {}).values())
            if total_usage % 5 == 0 or not prefs.get('persona') or prefs.get('persona') == "General User":
                persona_prompt = f"""
                Analyze the user's interaction style and expertise based on this question: "{user_question}"
                Return a JSON object with:
                - "persona": One word describing the user (e.g. Developer, Student, Artist, Curious, Professional)
                - "expertise": (Beginner, Intermediate, Advanced)
                - "tone": (Formal, Casual, Technical, Creative)
                - "interests": [List of 2-3 keywords]
                
                Respond ONLY with JSON.
                """
                model = genai.GenerativeModel('models/gemini-2.5-flash-lite')
                response = model.generate_content(persona_prompt)
                analysis = json.loads(response.text.strip().strip('```json').strip('```'))
                
                prefs['persona'] = analysis.get('persona', prefs.get('persona', 'General User'))
                prefs['expertise'] = analysis.get('expertise', prefs.get('expertise', 'Intermediate'))
                prefs['tone_preference'] = analysis.get('tone', 'Balanced')
                
                new_interests = analysis.get('interests', [])
                current_interests = set(prefs.get('interests', []))
                current_interests.update(new_interests)
                prefs['interests'] = list(current_interests)[:5] # Max 5 ilgi alanı
        except Exception as e:
            print(f"Persona analizi hatası: {e}")

    user.preferences = json.dumps(prefs)
    db.session.commit()

def post_process_response(text: str) -> str:
    """Yapay zeka yanıtlarını temizler ve hataları düzeltir (Markdown, Parantez vs)."""
    if not text:
        return ""
    
    # 1. Eksik Markdown bloklarını kapat
    code_block_count = text.count("```")
    if code_block_count % 2 != 0:
        text += "\n```"
    
    # 2. Basit parantez eşleştirme (Eksikse kapatmaya çalış)
    pairs = {"(": ")", "[": "]", "{": "}"}
    for open_char, close_char in pairs.items():
        if text.count(open_char) > text.count(close_char):
            diff = text.count(open_char) - text.count(close_char)
            if diff <= 2: # Çok fazla hata varsa dokunma, bozabiliriz
                text += close_char * diff

    # 3. Gereksiz başlangıç/bitiş temizliği
    text = text.strip()
    
    return text


def detect_intent(question: str, code: str = "") -> str:
    """Kullanıcı sorusunun niyetini belirler."""
    if not GEMINI_API_KEY:
        return "general"

    intent_prompt = f"""Analyze the user's question and determine the primary intent.
Choose exactly one of the following categories:
- 'code': Debugging, refactoring, code explanation, or technical implementation.
- 'logic': Complex algorithms, math, or abstract logical problems.
- 'creative': Writing, storytelling, poetry, or creative brainstorming.
- 'general': Greetings, simple facts, general conversation, or quick questions.

User Question: {question}
Related Code: {code if code else "None"}

Respond with ONLY the category name.
"""
    try:
        # Use Gemini 2.5 Flash Lite for fast intent detection
        model = genai.GenerativeModel('models/gemini-2.5-flash-lite')
        result = model.generate_content(intent_prompt)
        intent = getattr(result, "text", "general").strip().lower().replace("'", "").replace('"', '')
        
        # Validate intent
        if intent in ['code', 'logic', 'creative', 'general']:
            return intent
        return "general"
    except Exception as e:
        print(f"Intent detection error: {e}")
        return "general"


# --- SERİALİZASYON VE YARDIMCI FONKSİYONLAR ---

def serialize_history(item: History) -> dict:
    # Kullanıcı bilgisini conversation üzerinden al
    author_name = None
    author_id = None
    author_image = None
    if item.conversation and item.conversation.user:
        author_name = item.conversation.user.display_name
        author_id = item.conversation.user.id
        if item.conversation.user.profile_image:
            author_image = f"/uploads/{os.path.basename(item.conversation.user.profile_image)}"
    
    data = {
        'id': item.id,
        'conversation_id': item.conversation_id,
        'user_question': item.user_question,
        'ai_response': item.ai_response,
        'selected_model': item.selected_model,
        'timestamp': item.timestamp.strftime('%Y-%m-%d %H:%M'),
        'summary': item.summary or "",
        'likes': item.likes or 0,
        'answer_count': item.answers.count() if hasattr(item, 'answers') else 0,
        'image_url': f"{request.host_url.rstrip('/')}/api/files/{os.path.basename(item.image_path)}" if item.image_path else None,
        'author_name': author_name,
        'author_id': author_id,
        'author_image': author_image,
        'reasoning': item.reasoning or "",
        'routing_reason': item.routing_reason or "",
        'persona': item.persona or ""
    }

    # Eğer ai_response bir JSON string ise ve isComparison içeriyorsa
    try:
        import json
        if item.ai_response and item.ai_response.strip().startswith('{'):
            parsed = json.loads(item.ai_response)
            if parsed.get('isComparison'):
                data.update(parsed)
                # ai_response'u override et ki frontend tek kolonda json görmesin (geriye uyumluluk)
                # data['ai_response'] = parsed.get('ai_response', item.ai_response) 
                # Üstteki satır yerine parsed içindeki ai_response zaten doğru metni taşıyorsa onu kullanırız
                # Ancak frontend isComparison: true görünce zaten response1/response2 kullanacak.
    except:
        pass
        
    return data

def serialize_conversation(conv: Conversation) -> dict:
    return {
        'id': conv.id,
        'title': conv.title,
        'created_at': conv.created_at.strftime('%Y-%m-%d %H:%M'),
        'user_id': conv.user_id,
        'is_pinned': conv.is_pinned if hasattr(conv, 'is_pinned') else False,
        'is_archived': conv.is_archived if hasattr(conv, 'is_archived') else False
    }

def serialize_answer(answer: Answer) -> dict:
    return {
        'id': answer.id,
        'history_id': answer.history_id,
        'author': answer.author,
        'author_id': answer.author_id,
        'body': answer.body,
        'code_snippet': answer.code_snippet,
        'likes': answer.likes or 0,
        'image_url': f"{request.host_url.rstrip('/')}/api/files/{os.path.basename(answer.image_path)}" if answer.image_path else None,
        'created_at': answer.created_at.strftime('%Y-%m-%d %H:%M'),
    }

def serialize_user(user: User) -> dict:
    prefs = {}
    if user.preferences:
        try:
            prefs = json.loads(user.preferences)
        except:
            pass
            
    return {
        'id': user.id,
        'email': user.email,
        'display_name': user.display_name,
        'is_admin': user.is_admin,
        'profile_image': f"{request.host_url.rstrip('/')}/api/files/{os.path.basename(user.profile_image)}" if user.profile_image else None,
        'created_at': user.created_at.strftime('%Y-%m-%d %H:%M'),
        'preferences': prefs
    }

def hash_password(password: str) -> str:
    return pbkdf2_sha256.hash(password)

def verify_password(password: str, hashed: str) -> bool:
    return pbkdf2_sha256.verify(password, hashed)

def get_current_user():
    try:
        if verify_jwt_in_request(optional=True):
            identity = get_jwt_identity()
            if identity:
                return db.session.get(User, identity)
        return None
    except Exception:
        return None


# --- API ROTALARI ---

@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.json or {}
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''
    display_name = (data.get('display_name') or '').strip()

    if not email or not password or not display_name:
        return jsonify({'error': 'Email, password and display name are required.'}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'This email is already registered.'}), 409

    if User.query.filter_by(display_name=display_name).first():
        return jsonify({'error': 'This username is already taken.'}), 409

    user = User(
        email=email,
        display_name=display_name,
        password_hash=hash_password(password)
    )
    db.session.add(user)
    db.session.commit()

    token = create_access_token(identity=str(user.id))
    return jsonify({'token': token, 'user': serialize_user(user)}), 201


@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json or {}
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''

    user = User.query.filter_by(email=email).first()
    if not user or not verify_password(password, user.password_hash):
        return jsonify({'error': 'Incorrect email or password.'}), 401

    token = create_access_token(identity=str(user.id))
    return jsonify({'token': token, 'user': serialize_user(user)})


@app.route('/api/auth/me', methods=['GET'])
@jwt_required()
def me():
    user = get_current_user()
    return jsonify({'user': serialize_user(user)})


@app.route('/api/user/preferences', methods=['GET'])
@jwt_required()
def get_preferences_api():
    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    prefs = get_user_preferences(user)
    return jsonify({'preferences': prefs})


@app.route('/api/user/preferences', methods=['PUT'])
@jwt_required()
def update_preferences_api():
    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    data = request.json or {}
    current_prefs = get_user_preferences(user)
    
    # Allow manual override for specific fields
    if 'preferred_model' in data:
        current_prefs['preferred_model'] = data['preferred_model']
    if 'response_style' in data:
        current_prefs['response_style'] = data['response_style']
    if 'persona' in data:
        current_prefs['persona'] = data['persona']
    if 'expertise' in data:
        current_prefs['expertise'] = data['expertise']
    if 'interests' in data:
        # Expected list of strings
        current_prefs['interests'] = data['interests'] if isinstance(data['interests'], list) else current_prefs.get('interests', [])
        
    user.preferences = json.dumps(current_prefs)
    db.session.commit()
    
    return jsonify({'message': 'Preferences updated successfully', 'preferences': current_prefs})


@app.route('/api/auth/profile', methods=['PUT'])
@jwt_required()
def update_profile():
    """Kullanıcı profilini güncelle (display_name ve şifre)."""
    user = get_current_user()
    data = request.json or {}
    
    new_display_name = (data.get('display_name') or '').strip()
    new_password = data.get('new_password') or ''
    current_password = data.get('current_password') or ''
    
    # Display name güncelleme
    if new_display_name and new_display_name != user.display_name:
        # Benzersizlik kontrolü
        existing = User.query.filter_by(display_name=new_display_name).first()
        if existing and existing.id != user.id:
            return jsonify({'error': 'This username is already taken.'}), 409
        user.display_name = new_display_name
    
    # Şifre güncelleme
    if new_password:
        if not current_password:
            return jsonify({'error': 'Enter your current password.'}), 400
        if not verify_password(current_password, user.password_hash):
            return jsonify({'error': 'Incorrect current password.'}), 401
        user.password_hash = hash_password(new_password)
    
    db.session.commit()
    return jsonify({'user': serialize_user(user), 'message': 'Profile updated.'})


@app.route('/api/auth/profile/image', methods=['POST'])
@jwt_required()
def upload_profile_image():
    """Profil fotoğrafı yükle."""
    user = get_current_user()
    
    if 'image' not in request.files:
        return jsonify({'error': 'Image file required.'}), 400
    
    image_file = request.files['image']
    if not image_file.filename:
        return jsonify({'error': 'No file selected.'}), 400
    
    # Dosya uzantısı kontrolü
    allowed_extensions = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'jfif'}
    file_ext = image_file.filename.rsplit('.', 1)[-1].lower() if '.' in image_file.filename else ''
    if file_ext not in allowed_extensions:
        return jsonify({'error': 'Invalid file type. Upload PNG, JPG, JPEG, GIF, WEBP or JFIF.'}), 400
    
    # Dosyayı kaydet
    filename = secure_filename(f"profile_{user.id}_{int(time.time())}.{file_ext}")
    image_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    image_file.save(image_path)
    
    # Eski profil fotoğrafını sil (varsa)
    if user.profile_image and os.path.exists(user.profile_image):
        try:
            os.remove(user.profile_image)
        except:
            pass
    
    # Kullanıcı kaydını güncelle
    user.profile_image = image_path
    db.session.commit()
    
    return jsonify({
        'user': serialize_user(user),
        'message': 'Profile picture updated.'
    })


@app.route('/api/auth/profile/analyze', methods=['POST'])
@jwt_required()
def analyze_profile():
    """Analyzes user history to generate an adaptive AI profile."""
    user = get_current_user()
    
    # 1. Fetch recent history (Last 20 interactions)
    recent_history = History.query.filter_by(conversation_id=None).first() # Fallback logic check
    # Actually we need all history for this user, possibly across conversations
    # Join with Conversation to filter by user_id
    
    history_items = db.session.query(History).join(Conversation).filter(
        Conversation.user_id == user.id
    ).order_by(History.timestamp.desc()).limit(20).all()
    
    if not history_items:
        return jsonify({'message': 'Not enough history to analyze. Chat more!'}), 200
        
    conversation_text = ""
    for h in reversed(history_items): # Chronological order
        conversation_text += f"User: {h.user_question}\n"
        if h.code_snippet:
            conversation_text += f"User Code: {h.code_snippet}\n"
            
    # 2. Construct Analysis Prompt
    prompt = f"""
    Analyze the following user's conversation history with a coding assistant.
    Determine the following profile attributes based on their questions and code:
    
    1. 'expertise': "Beginner", "Intermediate", or "Advanced".
    2. 'interests': A list of top 3 technical topics they are interested in (e.g., "Python", "React", "Algorithms").
    3. 'persona': A short title for this user (e.g., "Frontend Learner", "Data Scientist", "System Architect").
    4. 'response_style': "concise" (if they ask for quick fixes) or "detailed" (if they ask for explanations).
    
    Output ONLY valid JSON in this format:
    {{
        "expertise": "...",
        "interests": ["...", "..."],
        "persona": "...",
        "response_style": "..."
    }}
    
    User History:
    {conversation_text}
    """
    
    # 3. Call Gemini for Analysis
    try:
        # Strategy: Try a chain of models until one works
        # Prioritize 2.5 Flash -> 1.5 Flash -> 1.5 Pro -> 1.0 Pro
        model_candidates = [
            'models/gemini-2.5-flash',
            'gemini-2.5-flash',
            'models/gemini-1.5-flash',
            'gemini-1.5-flash',
            'models/gemini-1.5-flash-001',
            'gemini-1.5-pro', 
            'gemini-pro'
        ]
        
        response = None
        last_error = None
        
        for m_name in model_candidates:
            try:
                print(f"Analyzing profile with model: {m_name}")
                model = genai.GenerativeModel(m_name)
                response = model.generate_content(prompt)
                if response:
                    break
            except Exception as e:
                print(f"Model {m_name} failed: {e}")
                last_error = e
                # Prepare for next candidate
                if "429" in str(e) or "quota" in str(e).lower():
                    time.sleep(1) # Backoff for quota errors
                continue
        
        # If Gemini fails, try Claude as final resort
        text = ""
        if not response and claude_client:
            try:
                # User requested 4.5 specifically
                target_claude = ANTHROPIC_MODEL if ANTHROPIC_MODEL else "claude-sonnet-4-5-20250929"
                print(f"Gemini models failed, trying Claude ({target_claude}) as fallback...")
                
                cl_msg = claude_client.messages.create(
                    model=target_claude,
                    max_tokens=1000,
                    system="You are an expert user profiler. Respond ONLY with valid JSON.",
                    messages=[{"role": "user", "content": prompt}]
                )
                text = cl_msg.content[0].text
                print(f"Claude ({target_claude}) analysis successful.")
            except Exception as ce:
                print(f"Claude fallback failed: {ce}")
                # Keep the last gemini error as the main one unless this fail is more specific
                if not last_error: last_error = ce

        if not response and not text:
            raise last_error or Exception("All models failed (Gemini chain + Claude Opus)")

        if response:
            text = response.text
        
        # Improve JSON extraction
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0]
        elif "```" in text:
            text = text.split("```")[1].split("```")[0]
            
        profile_data = json.loads(text.strip())
        
        # 4. Save to User Preferences
        user.preferences = json.dumps(profile_data)
        db.session.commit()
        
        return jsonify({
            'user': serialize_user(user),
            'message': 'Profile analyzed! (Updated based on history)'
        })
        
    except Exception as e:
        print(f"Profile analysis failed: {e}")
        error_msg = str(e)
        if "429" in error_msg or "quota" in error_msg.lower():
            return jsonify({'error': 'AI is busy (Rate Limit). Please try again in 1 minute.'}), 429
        return jsonify({'error': 'Failed to analyze profile.', 'details': str(e)}), 500


@app.route('/api/auth/delete-account', methods=['DELETE'])
@jwt_required()
def delete_account():
    """Kullanıcı hesabını ve ilgili tüm verileri siler."""
    user = get_current_user()
    data = request.json or {}
    password = data.get('password')

    if not password:
        return jsonify({'error': 'Enter your password for confirmation.'}), 400

    if not verify_password(password, user.password_hash):
        return jsonify({'error': 'Incorrect password.'}), 401

    try:
        # 1. Kullanıcının konuşmalarındaki History ID'lerini al
        conversations = Conversation.query.filter_by(user_id=user.id).all()
        conv_ids = [c.id for c in conversations]
        
        # 2. Bu konuşmalardaki History kayıtlarını al
        history_ids = []
        if conv_ids:
            histories = History.query.filter(History.conversation_id.in_(conv_ids)).all()
            history_ids = [h.id for h in histories]
        
        # 3. Bu History kayıtlarına ait PostLike'ları sil
        if history_ids:
            PostLike.query.filter(PostLike.history_id.in_(history_ids)).delete(synchronize_session=False)
        
        # 4. Bu History kayıtlarına ait Answer'ları ve AnswerLike'ları sil
        if history_ids:
            answers = Answer.query.filter(Answer.history_id.in_(history_ids)).all()
            answer_ids = [a.id for a in answers]
            if answer_ids:
                AnswerLike.query.filter(AnswerLike.answer_id.in_(answer_ids)).delete(synchronize_session=False)
            Answer.query.filter(Answer.history_id.in_(history_ids)).delete(synchronize_session=False)
        
        # 5. History kayıtlarını sil
        if history_ids:
            History.query.filter(History.id.in_(history_ids)).delete(synchronize_session=False)
        
        # 6. Konuşmaları sil
        if conv_ids:
            Conversation.query.filter(Conversation.id.in_(conv_ids)).delete(synchronize_session=False)
        
        # 7. Kullanıcının başka gönderilere yaptığı yorumları sil
        user_answers = Answer.query.filter_by(author_id=user.id).all()
        user_answer_ids = [a.id for a in user_answers]
        if user_answer_ids:
            AnswerLike.query.filter(AnswerLike.answer_id.in_(user_answer_ids)).delete(synchronize_session=False)
        Answer.query.filter_by(author_id=user.id).delete(synchronize_session=False)

        # 8. Kullanıcının beğenilerini sil
        PostLike.query.filter_by(user_id=user.id).delete(synchronize_session=False)
        AnswerLike.query.filter_by(user_id=user.id).delete(synchronize_session=False)

        # 9. Bildirimleri (Notification) sil
        # Hem kullanıcının aldığı hem de kullanıcının sebep olduğu bildirimler silinmeli
        Notification.query.filter(
            db.or_(Notification.user_id == user.id, Notification.related_user_id == user.id)
        ).delete(synchronize_session=False)
        
        # 9.1 Bildirim durumlarını sil
        NotificationRead.query.filter_by(user_id=user.id).delete(synchronize_session=False)
        NotificationHidden.query.filter_by(user_id=user.id).delete(synchronize_session=False)

        # 10. Takip (UserFollow) kayıtlarını sil
        # Hem takip ettikleri hem de takipçileri temizlenmeli
        UserFollow.query.filter(
            db.or_(UserFollow.follower_id == user.id, UserFollow.following_id == user.id)
        ).delete(synchronize_session=False)

        # 11. Snippet'ları sil
        Snippet.query.filter_by(user_id=user.id).delete(synchronize_session=False)
        
        # 12. PasswordResetToken'ları sil
        PasswordResetToken.query.filter_by(user_id=user.id).delete(synchronize_session=False)

        # 13. Profil fotoğrafını diskten sil
        if user.profile_image and os.path.exists(user.profile_image):
            try:
                os.remove(user.profile_image)
            except:
                pass

        # 14. Kullanıcıyı sil
        db.session.delete(user)
        db.session.commit()

        return jsonify({'message': 'Your account and all data have been successfully deleted.'})

    except Exception as e:
        db.session.rollback()
        print(f"Hesap silme hatası: {e}")
        return jsonify({'error': 'An error occurred while deleting account.'}), 500


# --- ŞİFRE SIFIRLAMA ---

def send_reset_email(to_email, reset_code):
    """Resend API veya SMTP ile şifre sıfırlama kodu gönderir.
    
    Production: RESEND_API_KEY kullanılır (önerilen)
    Development: SMTP ayarları kullanılabilir (fallback)
    """
    resend_api_key = os.getenv('RESEND_API_KEY')
    mail_from = os.getenv('MAIL_FROM', 'CodeAlchemist <onboarding@resend.dev>')
    
    html_content = f"""
    <html>
    <body style="font-family: Arial, sans-serif; background-color: #1a1a2e; color: #eee; padding: 20px;">
        <div style="max-width: 500px; margin: 0 auto; background: #16213e; border-radius: 12px; padding: 30px;">
            <h2 style="color: #a855f7; margin-bottom: 20px;">🔐 Password Reset</h2>
            <p>Hello,</p>
            <p>Password reset request received.</p>
            <div style="background: #0f0f23; border: 2px solid #a855f7; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
                <span style="font-size: 32px; font-weight: bold; color: #a855f7; letter-spacing: 8px;">{reset_code}</span>
            </div>
            <p style="color: #888; font-size: 14px;">This code will expire in 15 minutes.</p>
            <hr style="border: none; border-top: 1px solid #333; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">If you did not request this, please ignore this email.</p>
        </div>
    </body>
    </html>
    """
    
    text_content = f"""Hello,

Password reset request received.

Your Verification Code: {reset_code}

This code will expire in 15 minutes.

If you did not request this, please ignore this email.

CodeAlchemist Team"""
    
    # Öncelik 1: Resend API (Production için önerilen)
    if resend_api_key:
        try:
            resend.api_key = resend_api_key
            params = {
                "from": mail_from,
                "to": [to_email],
                "subject": "CodeAlchemist - Password Reset Code",
                "html": html_content,
                "text": text_content
            }
            email_response = resend.Emails.send(params)
            print(f"Password reset code sent (Resend): {to_email}, ID: {email_response.get('id')}")
            return True
        except Exception as e:
            print(f"Resend email sending error: {e}")
            return False
    
    # Öncelik 2: SMTP (Development/Fallback)
    mail_server = os.getenv('MAIL_SERVER', 'smtp.gmail.com')
    mail_port = int(os.getenv('MAIL_PORT', 587))
    mail_username = os.getenv('MAIL_USERNAME')
    mail_password = os.getenv('MAIL_PASSWORD')
    
    if not mail_username or not mail_password:
        # Development mode: Print code to console instead of sending email
        print("=" * 50)
        print("📧 DEVELOPMENT MODE - Email would be sent to:", to_email)
        print(f"🔐 PASSWORD RESET CODE: {reset_code}")
        print("=" * 50)
        return True  # Return success so user can use the code from console
    
    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = 'CodeAlchemist - Password Reset Code'
        msg['From'] = mail_username
        msg['To'] = to_email
        
        part1 = MIMEText(text_content, 'plain')
        part2 = MIMEText(html_content, 'html')
        msg.attach(part1)
        msg.attach(part2)
        
        with smtplib.SMTP(mail_server, mail_port) as server:
            server.starttls()
            server.login(mail_username, mail_password)
            server.sendmail(mail_username, to_email, msg.as_string())
        
        print(f"Password reset code sent (SMTP): {to_email}")
        return True
        
    except Exception as e:
        print(f"SMTP email sending error: {e}")
        return False


@app.route('/api/auth/forgot-password', methods=['POST'])
def forgot_password():
    """Şifre sıfırlama kodu gönderir."""
    data = request.json or {}
    email = data.get('email', '').strip().lower()
    
    if not email:
        return jsonify({'error': 'Email address required.'}), 400
    
    user = User.query.filter_by(email=email).first()
    if not user:
        # Güvenlik: Kullanıcı olmasa bile başarılı mesajı göster
        return jsonify({'message': 'If this email is registered, a password reset code has been sent.'})
    
    # 6 haneli rastgele kod oluştur
    reset_code = ''.join([str(random.randint(0, 9)) for _ in range(6)])
    
    # Eski tokenları sil
    PasswordResetToken.query.filter_by(user_id=user.id, used=False).delete()
    
    # Yeni token oluştur (15 dakika geçerli)
    token = PasswordResetToken(
        user_id=user.id,
        token=reset_code,
        expires_at=datetime.utcnow() + timedelta(minutes=15)
    )
    db.session.add(token)
    db.session.commit()
    
    # Email gönder
    if send_reset_email(email, reset_code):
        return jsonify({'message': 'Password reset code sent to your email address.'})
    else:
        return jsonify({'error': 'Failed to send email. Please try again later.'}), 500


@app.route('/api/auth/reset-password', methods=['POST'])
def reset_password():
    """Kod ile şifreyi sıfırlar."""
    data = request.json or {}
    email = data.get('email', '').strip().lower()
    code = data.get('code', '').strip()
    new_password = data.get('new_password', '')
    
    if not email or not code or not new_password:
        return jsonify({'error': 'Email, code and new password are required.'}), 400
    
    if len(new_password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters.'}), 400
    
    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({'error': 'Invalid code or email.'}), 400
    
    # Token'ı kontrol et
    token = PasswordResetToken.query.filter_by(
        user_id=user.id,
        token=code,
        used=False
    ).first()
    
    if not token:
        return jsonify({'error': 'Invalid or expired code.'}), 400
    
    if token.expires_at < datetime.utcnow():
        return jsonify({'error': 'Code expired. Request a new code.'}), 400
    
    # Şifreyi güncelle
    user.password_hash = hash_password(new_password)
    token.used = True
    db.session.commit()
    
    return jsonify({'message': 'Your password has been successfully updated. You can log in.'})


@app.route('/api/ask', methods=['POST'])
def ask():
    # Debug logging
    print(f"DEBUG: /api/ask called. Content-Type: {request.content_type}")
    
    # Handle multipart/form-data
    if request.content_type and 'multipart/form-data' in request.content_type:
        question = request.form.get('question', '')
        code = request.form.get('code', '')
        model = request.form.get('model', 'gemini-2.5-pro')
        conversation_id = request.form.get('conversation_id')
        if conversation_id == 'null' or conversation_id == 'undefined':
            conversation_id = None
        
        image_file = request.files.get('image')
        image_path = None
        if image_file and image_file.filename:
            filename = secure_filename(f"{int(time.time())}_{image_file.filename}")
            image_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            image_file.save(image_path)
    else:
        # Handle JSON (or attempt to parse as JSON)
        data = request.get_json(silent=True) or {}
        question = data.get('question', '')
        code = data.get('code', '')
        model = data.get('model', 'gemini-2.5-pro')
        conversation_id = data.get('conversation_id')
        image_path = None
    
    # Kullanıcı tespiti
    user = get_current_user()
    user_id = user.id if user else None
    
    # AI Taste Profile al
    prefs = get_user_preferences(user)

    # Check if this is a no-save request (used for model comparison)
    no_save = data.get('no_save', False) if 'data' in dir() and data else False
    if request.content_type and 'application/json' in request.content_type:
        no_save = request.get_json(silent=True).get('no_save', False) if request.get_json(silent=True) else False

    # Konuşma Yönetimi
    conversation = None
    history_context = []

    if not no_save:
        if conversation_id:
            conversation = db.session.get(Conversation, conversation_id)
            # Eğer conversation varsa, geçmişi çek
            if conversation:
                # Sadece bu konuşmaya ait son 5 mesajı al (Token tasarrufu için)
                prev_items = History.query.filter_by(conversation_id=conversation.id)\
                    .order_by(History.timestamp.desc())\
                    .limit(5)\
                    .all()
                # Descending aldığımız için kronolojik sıraya geri çeviriyoruz
                prev_items.reverse()
                
                for item in prev_items:
                    history_context.append({'user': item.user_question, 'ai': item.ai_response})
        
        if not conversation:
            # Yeni konuşma başlat
            conversation = Conversation(user_id=user_id, title=question[:50])
            db.session.add(conversation)
            db.session.commit()

        print(f"Model İsteği: {model}, ConvID: {conversation.id}, Image: {image_path}")
    else:
        print(f"Model İsteği (no_save): {model}, Image: {image_path}")

    # --- Akıllı Model Routing (Smart Routing) ---
    original_model = model
    routing_reason = None
    
    # Ses dosyası kontrolü - Sadece Gemini ses desteği sağlıyor
    audio_extensions = ['.mp3', '.wav', '.webm', '.m4a', '.ogg', '.aac', '.flac']
    is_audio_file = image_path and any(image_path.lower().endswith(ext) for ext in audio_extensions)
    
    # Model fonksiyonlarına gönderilecek image_path (Varsayılan: orijinal path)
    model_image_path = image_path 
    
    if is_audio_file:
        # Eğer seçilen model Gemini değilse, sesi metne çevir ve öyle gönder
        if 'gemini' not in model:
            print(f"DEBUG: Audio detected for non-Gemini model ({model}). Transcribing...")
            transcription = transcribe_audio_with_gemini(image_path)
            
            if transcription:
                # Transkripti soruya ekleyelim ve modele özel talimat verelim
                instruction = (
                    f"\n\n[System: The user sent a voice message. Here is the transcription:]\n"
                    f"\"{transcription}\"\n\n"
                    f"[Instruction: Start your response by strictly quoting the transcription as follows: '**You said:** {transcription}'. Then provide your answer.]"
                )
                
                if question:
                    question = f"{question}{instruction}"
                else:
                    question = instruction
                
                # Ses dosyasını model fonksiyonuna GÖNDERME (çünkü metne çevirdik)
                model_image_path = None 
                
                routing_reason = f"🎤 Ses mesajı metne çevrildi ve **{model}** modeline iletildi."
            else:
                # Transkripsiyon başarısızsa Gemini'ye fallback yap
                model = 'gemini-2.0-flash'
                routing_reason = "⚠️ Ses çevrilemedi, ses desteği için **Gemini 2.0 Flash** modeline geçildi."
        else:
            # Gemini zaten seçili
            if model != 'gemini-2.0-flash' and 'flash' not in model:
                 model = 'gemini-2.0-flash'
                 routing_reason = "🎤 Ses mesajı işleme için **Gemini 2.0 Flash** modeli optimize edildi."
    
    # Görsel Oluşturma İsteği Kontrolü (Image Generation Intent)
    q_lower = question.lower()
    
    # Daha esnek Türkçe kontrolü
    creation_verbs = ['çiz', 'oluştur', 'yarat', 'yap', 'hazırla', 'generate', 'create', 'draw', 'make', 'tasarla', 'üret', 'çizsene', 'yaparmısın', 'çizer misin', 'istiyorum', 'gönder', 'yolla']
    image_nouns = ['resim', 'görsel', 'fotoğraf', 'image', 'picture', 'photo', 'drawing', 'art', 'logo', 'ikon', 'icon', 'sketch', 'tasarım', 'resmini', 'gorselini', 'fotografini', 'resmi', 'gorseli', 'fotografi', 'çizim', 'cizim', 'png', 'jpg', 'karikatür', 'illüstrasyon', 'poster', 'afiş', 'kapak', 'banner']
    
    # Basit anahtar kelime öbekleri
    exact_phrases = [
        'create image', 'generate image', 'draw a picture', 'resim çiz', 'görsel oluştur', 
        'resim yap', 'görsel yarat', 'fotoğraf oluştur', 'resim istiyorum', 'görsel istiyorum',
        'çizgi film', 'logo yap', 'ikon yap', 'resmi yap', 'görseli yap'
    ]
    
    # Kelime bazlı kontrol (Hem 'resim' hem 'çiz' geçiyorsa)
    has_noun = any(noun in q_lower for noun in image_nouns)
    has_verb = any(verb in q_lower for verb in creation_verbs)
    
    # Kodlama ile çizim isteği (matplotlib, turtle vs.) var mı?
    code_keywords = ['python', 'kod', 'code', 'script', 'matplotlib', 'turtle', 'grafik', 'plot', 'chart', 'pandas', 'seaborn', 'html', 'css', 'react', 'component']
    has_code_intent = any(k in q_lower for k in code_keywords)
    
    # Logic update: If strong phrases match, ignore code check. If noun+verb, check code.
    is_image_scope = (has_noun and has_verb) or any(phrase in q_lower for phrase in exact_phrases)
    
    # Resim ve fiil varsa, kod isteği yoksa DALL-E varsay.
    # image_path olsa bile (belki referans resimdir), DALL-E'yi deniyoruz (API desteklemese bile prompt ile deneriz).
    is_image_request = is_image_scope and (not has_code_intent) and len(question) < 1000
    
    if is_image_request:
        model = 'dall-e-3'
        routing_reason = "🎨 Görsel oluşturma isteği algılandı (resim+fiil), **DALL-E 3** seçildi."
        print(f"DEBUG: Image generation request detected: {model}")
        sys.stdout.flush()

    elif model == 'auto':
        preferred = prefs.get('preferred_model', 'auto')
        intent = detect_intent(question, code)
        
        # Intent bazlı eşleştirme
        model_map = {
            'code': 'claude-sonnet-4-5-20250929',
            'general': 'gemini-2.5-flash-lite',
            'logic': 'gpt-4o',
            'creative': 'gemini-3-flash'
        }
        
        # Eğer kullanıcı bir modeli daha çok seviyorsa (preferred != auto)
        # ve intent 'general' ise kullanıcının tercihini kullan
        if preferred != 'auto' and intent == 'general':
            model_type_map = {
                'claude': 'claude-sonnet-4-5-20250929',
                'gemini': 'gemini-2.5-flash-lite',
                'gpt': 'gpt-4o'
            }
            model = model_type_map.get(preferred, model_map.get(intent))
            routing_reason = f"Kişisel Tercih: Sık kullanımınızdan dolayı **{model}** seçildi. (Taste Profile)"
        else:
            model = model_map.get(intent, 'gemini-2.5-flash-lite')
        intent_names = {
            'code': ('Kod/Hata Ayıklama', 'Code/Debugging'),
            'general': ('Genel/Hızlı Yanıt', 'General/Fast Response'),
            'logic': ('Karmaşık Mantık', 'Complex Logic'),
            'creative': ('Yaratıcı Yazarlık', 'Creative Writing')
        }
        name_tr, name_en = intent_names.get(intent, (intent, intent))
        
        # Simple language detection: if question contains common Turkish characters/words
        is_turkish = any(c in question.lower() for c in "çıüğöış") or any(w in question.lower().split() for w in ["bir", "ve", "ne", "nasıl"])
        
        if is_turkish:
            routing_reason = routing_reason or f"Akıllı Yönlendirme: '{name_tr}' kategorisi algılandı, **{model}** modeli seçildi."
        else:
            routing_reason = routing_reason or f"Smart Routing: Detected '{name_en}' category, selected **{model}** model."
        
        print(f"DEBUG: Smart Routing -> {intent} -> {model}")

    answer = ""

    # --- Model Yönlendirme Mantığı ---
    def generate_stream():
        nonlocal answer # Outer scope answer variable updating
        full_answer = ""
        
        generator = None
        
        # Generator seçimi
        if model == 'dall-e-3':
             # DALL-E streaming desteklemez, senkron çağırıp yield ediyoruz
             img_response = generate_image_with_dalle(question)
             full_answer = img_response
             json_data = json.dumps({'chunk': img_response})
             yield f"data: {json_data}\n\n"
             # Continue to allow DB saving logic below to run
             generator = None # No further generation needed


        if 'claude' in model:
            generator = generate_claude_answer(question, code, history_context, model, model_image_path, prefs)
        elif 'gpt' in model or 'o1' in model:
             generator = generate_gpt_answer(question, code, history_context, model, model_image_path, prefs)
        elif 'gemini' in model or 'gemma' in model:
            generator = generate_gemini_answer(question, code, history_context, model, model_image_path, prefs)

        # Ortak Generator Döngüsü
        if generator:
            try:
                for chunk in generator:
                    if chunk:
                        full_answer += chunk
                        json_data = json.dumps({'chunk': chunk})
                        yield f"data: {json_data}\n\n"
                        
                # 0. Post-Processing Layer (İşlem Sonrası Katmanı)
                full_answer = post_process_response(full_answer)
                
            except Exception as e:
                err_msg = f"\n[Model Error]: {str(e)}"
                full_answer += err_msg
                json_data = json.dumps({'chunk': err_msg})
                yield f"data: {json_data}\n\n"

        # Bitiş işlemleri (Veritabanı kayıt)
        with app.app_context():
            # Only save to database if not a no_save request
            if not no_save and conversation:
                # Session'a conversation'ı tekrar bağla/getir
                current_conv = db.session.get(Conversation, conversation.id)
                if not current_conv:
                    # Should not happen normally
                    current_conv = Conversation(id=conversation.id, user_id=user_id, title=question[:50])
                    db.session.add(current_conv)

                # Özetleme
                summary = summarize_answer(full_answer)
                
                # Başlık güncelleme (ilk mesajsa) - kısa ve öz başlık üret
                if not history_context:
                    current_conv.title = generate_conversation_title(question, full_answer)
                    db.session.add(current_conv)

                history = History(
                    conversation_id=current_conv.id,
                    user_question=question,
                    code_snippet=code,
                    ai_response=full_answer,
                    selected_model=model,
                    summary=summary,
                    image_path=image_path,
                    routing_reason=routing_reason,
                    persona=prefs.get('persona', 'General User') if user else 'General User'
                )
                db.session.add(history)
                db.session.commit()
                print(f"DEBUG: Saved history item {history.id} for conv {current_conv.id}")

                # 4. AI Taste Profile Güncelle (Öğrenme + Persona Analizi)
                if user:
                    update_user_taste(user, model, full_answer, question)

                # Final event with metadata
                final_data = {
                    'done': True,
                    'history_id': history.id,
                    'conversation_id': current_conv.id,
                    'summary': summary,
                    'routing_reason': routing_reason,
                    'persona': history.persona
                }
                yield f"data: {json.dumps(final_data)}\n\n"
            else:
                # No-save mode: just signal completion without DB info
                final_data = {'done': True}
                yield f"data: {json.dumps(final_data)}\n\n"

    return Response(stream_with_context(generate_stream()), mimetype='text/event-stream')


# ==========================================
# MULTI-MODEL BLEND (ÇOKLU MODEL HARMANLAMA)
# ==========================================

from concurrent.futures import ThreadPoolExecutor, as_completed

def fetch_model_response_sync(model: str, question: str, code: str = '', prefs = None):
    """Tek bir modelden senkron yanıt al (thread içinde kullanılır)."""
    full_response = ""
    # prefs is passed directly now, no need to call get_user_preferences here
    
    try:
        if 'claude' in model:
            for chunk in generate_claude_answer(question=question, code=code, history_context=[], requested_model=model, prefs=prefs):
                full_response += chunk
        elif 'gpt' in model:
            for chunk in generate_gpt_answer(question=question, code=code, history_context=[], requested_model=model, prefs=prefs):
                full_response += chunk
        elif 'gemini' in model or 'gemma' in model:
            for chunk in generate_gemini_answer(question=question, code=code, history_context=[], requested_model=model, prefs=prefs):
                full_response += chunk
    except Exception as e:
        full_response = f"[{model} Error]: {str(e)}"
    return model, full_response


@app.route('/api/blend', methods=['POST'])
def blend_models():
    """Birden fazla modelden yanıt al ve Gemini ile harmanlayarak tek yanıt döndür."""
    data = request.get_json(silent=True) or {}
    question = data.get('question', '')
    code = data.get('code', '')
    models = data.get('models', [])  # List of model names
    conversation_id = data.get('conversation_id')  # Optional conversation ID
    
    if not question:
        return jsonify({'error': 'Question required'}), 400
    
    if not models or len(models) < 2:
        return jsonify({'error': 'At least 2 models must be selected'}), 400
    
    if len(models) > 4:
        return jsonify({'error': 'Maximum 4 models can be selected'}), 400
    
    print(f"BLEND İsteği: {len(models)} model - {models}")
    
    # Get current user for conversation saving and personalization
    user = get_current_user()
    prefs = get_user_preferences(user)
    persona = prefs.get('persona', 'General User')
    expertise = prefs.get('expertise', 'intermediate')
    
    # Create or get conversation
    if user:
        if conversation_id:
            conversation = Conversation.query.filter_by(id=conversation_id, user_id=user.id).first()
        else:
            # Create new conversation
            conversation = Conversation(
                user_id=user.id,
                title=question[:50] + ('...' if len(question) > 50 else ''),
                created_at=datetime.now()
            )
            db.session.add(conversation)
            db.session.commit()
            conversation_id = conversation.id
    else:
        conversation = None
        conversation_id = None
    
    def generate_blend_stream():
        model_responses = {}
        
        # 1. Paralel olarak tüm modellerden yanıt al
        yield f"data: {json.dumps({'status': 'fetching', 'message': 'Sending query to selected models...'})}\n\n"
        
        with ThreadPoolExecutor(max_workers=4) as executor:
            futures = {
                executor.submit(fetch_model_response_sync, model, question, code, prefs): model 
                for model in models
            }
            
            completed = 0
            try:
                # Add 30s timeout to prevent infinite freezing
                for future in as_completed(futures, timeout=30):
                    model_name, response = future.result()
                    model_responses[model_name] = response
                    completed += 1
                    yield f"data: {json.dumps({'status': 'progress', 'completed': completed, 'total': len(models), 'model': model_name})}\n\n"
            except Exception as e:
                # Timeout or other error during execution
                print(f"Blending timeout/error: {e}")
                for f in futures:
                    f.cancel()
                # Fill missing models with error text so blending can continue
                for f, m_name in futures.items():
                    if m_name not in model_responses:
                        model_responses[m_name] = f"[{m_name} Error]: Timeout or execution failed."
        
        # 2. Tüm yanıtları Gemini ile harmanlama
        yield f"data: {json.dumps({'status': 'blending', 'message': 'Blending responses...'})}\n\n"
        
        # Harmanlama prompt'u oluştur
        blend_prompt = f"""Below are the answers given by different AI models to the same question.
Analyze these responses and combine the best parts of all of them to create a single, comprehensive and consistent "super response".

**USER CONTEXT:**
- Persona: {persona}
- Expertise Level: {expertise}
- Interests: {', '.join(prefs.get('interests', []))}

**QUESTION:** {question}

"""
        for model_name, response in model_responses.items():
            blend_prompt += f"**{model_name} Response:**\n{response}\n\n---\n\n"
        
        blend_prompt += """
**Your Task:**
1. Identify valuable information in each model's response
2. Compare conflicting information and choose the most accurate one
3. Combine all of these into a single, fluent and comprehensive response
4. Do not mention source models, only give the blended result
5. IMPORTANT: Respond in the same language as the user's question (e.g., if the question is in Turkish, respond in Turkish).
"""
        
        # Gemini ile harmanla (Fallback mekanizmalı)
        blended_response = ""
        blender_models = ['gemini-2.5-flash', 'gpt-4o', 'claude-sonnet-4-5-20250929']
        blender_error = None
        
        success = False
        for blender_model in blender_models:
            if success: break
            
            try:
                # Modeli seç ve generate et
                generator = None
                if 'gemini' in blender_model:
                    generator = generate_gemini_answer(blend_prompt, '', [], blender_model)
                elif 'gpt' in blender_model:
                    generator = generate_gpt_answer(blend_prompt, '', [], blender_model)
                elif 'claude' in blender_model:
                    generator = generate_claude_answer(blend_prompt, '', [], blender_model)
                
                temp_response = ""
                error_in_stream = False
                
                if generator:
                    for chunk in generator:
                        # Kota hatası kontrolü (Gemini için)
                        if "[Error]: Quota limit exceeded" in chunk:
                            error_in_stream = True
                            break
                            
                        temp_response += chunk
                        yield f"data: {json.dumps({'status': 'streaming', 'chunk': chunk})}\n\n"
                
                if not error_in_stream and temp_response:
                    blended_response = temp_response
                    success = True
                else:
                    # Bu model başarısız oldu, bir sonrakine geç
                    continue
                    
            except Exception as e:
                blender_error = e
                continue

        if not success:
             error_msg = str(blender_error) if blender_error else "All blending models failed."
             blended_response = f"Blending error: {error_msg}"
             yield f"data: {json.dumps({'status': 'error', 'message': error_msg})}\n\n"
        
        # 2.5 Referee (Judge) Call for Explainable AI
        referee_reasoning = ""
        if success and blended_response:
            yield f"data: {json.dumps({'status': 'refereeing', 'message': 'AI Referee is evaluating the models...'})}\n\n"
            
            referee_prompt = f"""Compare the following AI model responses and the final blended result.
Provide a clear reasoning/justification for why this blended response was chosen and how the models performed.

**QUESTION:** {question}

"""
            for model_name, response in model_responses.items():
                referee_prompt += f"**{model_name} Response:**\n{response}\n\n"
            
            referee_prompt += f"\n**FINAL BLENDED RESPONSE:**\n{blended_response}\n\n"
            
            referee_prompt += """
**Referee Task:**
1. Briefly compare model performances and the final blended result.
2. Which model was strongest? Which had errors or omissions?
3. Justify the blended result.

**Constraints:**
- Keep the entire evaluation EXTREMELY CONCISE and bulleted.
- EXPLICITLY STATE why you used which model (e.g., "GPT-4o provided better code, so it was prioritized for the solution").
- Explain the contribution of each model to the final answer.
- IMPORTANT: Respond in the same language as the user's question (e.g., if the question is in Turkish, respond in Turkish).
"""
            try:
                # Use Gemini 2.5 Flash as referee
                referee_model = genai.GenerativeModel('models/gemini-2.5-flash')
                referee_result = referee_model.generate_content(referee_prompt)
                referee_reasoning = getattr(referee_result, "text", "").strip()
                yield f"data: {json.dumps({'status': 'referee_done', 'reasoning': referee_reasoning})}\n\n"
            except Exception as ref_err:
                print(f"Referee error: {ref_err}")
                referee_reasoning = f"Referee failed: {str(ref_err)}"
        
        # 3. Save to database if user is logged in
        if user and conversation_id and blended_response:
            try:
                history_entry = History(
                    conversation_id=conversation_id,
                    user_question=question,
                    ai_response=blended_response,
                    code_snippet=code if code else None,
                    selected_model=f"Blend: {', '.join(models[:2])}{'...' if len(models) > 2 else ''}",
                    timestamp=datetime.now(),
                    reasoning=referee_reasoning,
                    routing_reason=f"Blended {', '.join(models)} for enhanced accuracy",
                    persona=persona
                )
                db.session.add(history_entry)
                db.session.commit()
                print(f"DEBUG: Saved Blend History item {history_entry.id}")
                
                # Update Taste Profile
                update_user_taste(user, "blend", blended_response, question)
            except Exception as db_err:
                print(f"Database save error (blend): {db_err}")
        
        # 4. Return final result
        final_data = {
            'done': True,
            'blended_response': blended_response,
            'source_models': list(model_responses.keys()),
            'individual_responses': model_responses,
            'conversation_id': conversation_id,
            'history_id': history_entry.id if (user and conversation_id and blended_response) else None,
            'persona': persona,
            'routing_reason': f"Blended {', '.join(models)} for enhanced accuracy"
        }
        yield f"data: {json.dumps(final_data)}\n\n"
    
    return Response(stream_with_context(generate_blend_stream()), mimetype='text/event-stream')


@app.route('/api/conversations', methods=['GET'])
def list_conversations():
    user = get_current_user()
    if user:
        # Kullanıcının konuşmaları (Community postları ve arşivlenmiş olanlar HARİÇ)
        community_conv_ids = db.session.query(History.conversation_id)\
            .filter(History.selected_model == 'Community')\
            .subquery()

        convs = Conversation.query.filter_by(user_id=user.id)\
            .filter(Conversation.id.notin_(community_conv_ids))\
            .filter(db.or_(Conversation.is_archived == False, Conversation.is_archived == None))\
            .order_by(Conversation.is_pinned.desc(), Conversation.created_at.desc())\
            .all()
    else:
        convs = []
    
    return jsonify({'conversations': [serialize_conversation(c) for c in convs]})


@app.route('/api/conversations', methods=['POST'])
@jwt_required()
def create_conversation():
    user = get_current_user()
    data = request.json or {}
    title = data.get('title', 'New Chat')
    
    conversation = Conversation(
        user_id=user.id,
        title=title,
        created_at=datetime.now()
    )
    db.session.add(conversation)
    db.session.commit()
    
    return jsonify({'conversation': serialize_conversation(conversation)})


# --- CONVERSATION MANAGEMENT ENDPOINTS ---

@app.route('/api/conversations/<int:conversation_id>/rename', methods=['PUT'])
@jwt_required()
def rename_conversation(conversation_id):
    """Konuşma başlığını yeniden adlandırır."""
    conversation = Conversation.query.get_or_404(conversation_id)
    user = get_current_user()
    
    if conversation.user_id != user.id:
        return jsonify({'error': 'Unauthorized access'}), 403
    
    data = request.json or {}
    new_title = data.get('title', '').strip()
    
    if not new_title:
        return jsonify({'error': 'Title cannot be empty'}), 400
    
    conversation.title = new_title[:255]  # Max 255 karakter
    db.session.commit()
    
    return jsonify({'conversation': serialize_conversation(conversation), 'message': 'Title updated'})


@app.route('/api/conversations/<int:conversation_id>/pin', methods=['PUT'])
@jwt_required()
def pin_conversation(conversation_id):
    """Konuşmayı sabitle veya sabitlemeden çıkar."""
    conversation = Conversation.query.get_or_404(conversation_id)
    user = get_current_user()
    
    if conversation.user_id != user.id:
        return jsonify({'error': 'Unauthorized access'}), 403
    
    conversation.is_pinned = not conversation.is_pinned
    db.session.commit()
    
    status = 'pinned' if conversation.is_pinned else 'unpinned'
    return jsonify({'conversation': serialize_conversation(conversation), 'message': f'Chat {status}'})


@app.route('/api/conversations/<int:conversation_id>/archive', methods=['PUT'])
@jwt_required()
def archive_conversation(conversation_id):
    """Konuşmayı arşivle veya arşivden çıkar."""
    conversation = Conversation.query.get_or_404(conversation_id)
    user = get_current_user()
    
    if conversation.user_id != user.id:
        return jsonify({'error': 'Unauthorized access'}), 403
    
    conversation.is_archived = not conversation.is_archived
    db.session.commit()
    
    status = 'archived' if conversation.is_archived else 'unarchived'
    return jsonify({'conversation': serialize_conversation(conversation), 'message': f'Chat {status}'})




@app.route('/api/conversations/archived', methods=['GET'])
@jwt_required()
def list_archived_conversations():
    """Arşivlenmiş konuşmaları listeler."""
    user = get_current_user()
    
    community_conv_ids = db.session.query(History.conversation_id)\
        .filter(History.selected_model == 'Community')\
        .subquery()

    convs = Conversation.query.filter_by(user_id=user.id)\
        .filter(Conversation.id.notin_(community_conv_ids))\
        .filter(Conversation.is_archived == True)\
        .order_by(Conversation.created_at.desc())\
        .all()
    
    return jsonify({'conversations': [serialize_conversation(c) for c in convs]})


@app.route('/api/community/my-posts', methods=['GET'])
@jwt_required()
def get_user_posts():
    user = get_current_user()
    # Kullanıcının 'Community' olarak işaretlenmiş postlarını getir
    items = History.query.join(Conversation)\
        .filter(Conversation.user_id == user.id)\
        .filter(History.selected_model == 'Community')\
        .order_by(History.timestamp.desc())\
        .all()
    return jsonify({'posts': [serialize_history(h) for h in items]})


@app.route('/api/conversations/<int:conversation_id>', methods=['GET'])
def get_conversation(conversation_id):
    conversation = Conversation.query.get_or_404(conversation_id)
    # Güvenlik: Eğer kullanıcı giriş yapmışsa ve bu konuşma başkasınınsa erişimi engelle (admin hariç)
    user = get_current_user()
    if conversation.user_id and (not user or (user.id != conversation.user_id and not user.is_admin)):
         return jsonify({'error': 'Unauthorized access'}), 403

    items = History.query.filter_by(conversation_id=conversation_id).order_by(History.timestamp.asc()).all()
    return jsonify({
        'conversation': serialize_conversation(conversation),
        'history': [serialize_history(h) for h in items]
    })


@app.route('/api/conversations/<int:conversation_id>', methods=['DELETE'])
def delete_conversation(conversation_id):
    conversation = Conversation.query.get_or_404(conversation_id)
    user = get_current_user()
    if conversation.user_id and (not user or (user.id != conversation.user_id and not user.is_admin)):
         return jsonify({'error': 'Unauthorized access'}), 403
    
    # History'lere bağlı verileri önce sil
    histories = History.query.filter_by(conversation_id=conversation_id).all()
    history_ids = [h.id for h in histories]
    
    if history_ids:
        # PostLike'ları sil
        PostLike.query.filter(PostLike.history_id.in_(history_ids)).delete(synchronize_session=False)
        
        # Answer'lara bağlı AnswerLike'ları sil
        answers = Answer.query.filter(Answer.history_id.in_(history_ids)).all()
        answer_ids = [a.id for a in answers]
        if answer_ids:
            AnswerLike.query.filter(AnswerLike.answer_id.in_(answer_ids)).delete(synchronize_session=False)
        
        # Answer'ları sil
        Answer.query.filter(Answer.history_id.in_(history_ids)).delete(synchronize_session=False)
        
        # History'leri sil
        History.query.filter(History.id.in_(history_ids)).delete(synchronize_session=False)
    
    db.session.delete(conversation)
    db.session.commit()
    return jsonify({'status': 'deleted'})


@app.route('/api/conversations/<int:conversation_id>/history', methods=['POST'])
@jwt_required()
def add_history_item(conversation_id):
    """Konuşmaya manuel olarak (generate etmeden) bir geçmiş öğesi ekler."""
    conversation = Conversation.query.get_or_404(conversation_id)
    user = get_current_user()
    
    if conversation.user_id != user.id:
        return jsonify({'error': 'Unauthorized access'}), 403
        
    data = request.json or {}
    user_question = data.get('user_question')
    ai_response = data.get('ai_response')
    selected_model = data.get('selected_model', 'Unknown')
    
    if not user_question or not ai_response:
        return jsonify({'error': 'Question and answer required'}), 400
        
    history = History(
        conversation_id=conversation.id,
        user_question=user_question,
        ai_response=ai_response,
        selected_model=selected_model,
        timestamp=datetime.now()
    )
    
    db.session.add(history)
    conversation.updated_at = datetime.now()
    db.session.commit()
    
    return jsonify(serialize_history(history))


@app.route('/api/posts/<int:post_id>', methods=['DELETE'])
@jwt_required()
def delete_post(post_id):
    """Kullanıcının kendi gönderisini siler."""
    user = get_current_user()
    
    # Gönderiyi (History kaydını) bul
    history = History.query.get_or_404(post_id)
    
    # Gönderi sahibini kontrol et
    # Gönderi sahibini kontrol et
    # Orphaned post check (Conversation deleted but post remains)
    if not history.conversation:
         # If checking for orphaned posts, strictly speaking only admin should delete
         # or we assume data corruption and allow delete if user is authed? 
         # Let's say if no conversation, we can't verify owner easily unless we trust some other field.
         # For now, let's allow Admin to clean it up.
         if not user.is_admin:
             return jsonify({'error': 'Post corrupted (no conversation link). Contact admin.'}), 404
    else:
        # Normal check
        if not history.conversation.user:
             # Conversation exists but user is None?
             if not user.is_admin:
                 return jsonify({'error': 'Post owner not found.'}), 404
        elif history.conversation.user_id != user.id and not user.is_admin:
            return jsonify({'error': 'You do not have permission to delete this post.'}), 403
    
    try:
        # 1. PostLike'ları sil
        PostLike.query.filter_by(history_id=post_id).delete(synchronize_session=False)
        
        # 2. Answer'lara bağlı AnswerLike'ları sil
        answers = Answer.query.filter_by(history_id=post_id).all()
        answer_ids = [a.id for a in answers]
        if answer_ids:
            AnswerLike.query.filter(AnswerLike.answer_id.in_(answer_ids)).delete(synchronize_session=False)
        
        # 3. Answer'ları sil
        Answer.query.filter_by(history_id=post_id).delete(synchronize_session=False)
        
        # 4. Gönderiyi (History) sil
        db.session.delete(history)
        
        # Also clean up the Conversation if it was a community post created just for this
        if history.selected_model == 'Community' and history.conversation:
             # Check if this conversation has other history?
             other_history = History.query.filter(
                 History.conversation_id == history.conversation_id, 
                 History.id != history.id
             ).count()
             if other_history == 0:
                 db.session.delete(history.conversation)

        db.session.commit()
        
        return jsonify({'message': 'Post deleted.'})
    
    except Exception as e:
        db.session.rollback()
        print(f"Gönderi silme hatası: {e}")
        return jsonify({'error': 'An error occurred while deleting the post.'}), 500


@app.route('/api/posts/<int:post_id>', methods=['PUT'])
@jwt_required()
def edit_post(post_id):
    """Kullanıcının kendi gönderisini düzenler."""
    user = get_current_user()
    
    # Gönderiyi (History kaydını) bul
    history = History.query.get_or_404(post_id)
    
    # Gönderi sahibini kontrol et
    if not history.conversation or not history.conversation.user:
        return jsonify({'error': 'Post not found.'}), 404
    
    if history.conversation.user_id != user.id and not user.is_admin:
        return jsonify({'error': 'You do not have permission to edit this post.'}), 403
    
    data = request.json or {}
    new_question = data.get('user_question', '').strip()
    new_summary = data.get('summary', '').strip()
    
    if not new_question:
        return jsonify({'error': 'Question field cannot be empty.'}), 400
    
    try:
        history.user_question = new_question
        if new_summary:
            history.summary = new_summary
        
        db.session.commit()
        
        return jsonify({
            'message': 'Post updated.',
            'post': serialize_history(history)
        })
    
    except Exception as e:
        db.session.rollback()
        print(f"Gönderi düzenleme hatası: {e}")
        return jsonify({'error': 'An error occurred while editing the post.'}), 500


@app.route('/api/notifications', methods=['GET'])
def get_notifications():
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized access'}), 401

    results = []

    # 1. Yorum Bildirimleri (Answer)
    # Kullanıcının sorularına (History) gelen cevaplar - Community postları hariç
    answers = db.session.query(Answer, History, Conversation)\
        .join(History, Answer.history_id == History.id)\
        .join(Conversation, History.conversation_id == Conversation.id)\
        .filter(Conversation.user_id == user.id)\
        .filter(Answer.author_id != user.id)\
        .filter(History.selected_model != 'Community')\
        .order_by(Answer.created_at.desc())\
        .limit(20)\
        .all()

    for answer, history, conversation in answers:
        results.append({
            'id': f"ans-{answer.id}",
            'type': 'comment',
            'author': answer.author,
            'message': f"{answer.author} added a solution to your question!",
            'question_title': conversation.title,
            'created_at': answer.created_at.strftime('%Y-%m-%d %H:%M'),
            'timestamp_obj': answer.created_at,
            'conversation_id': conversation.id,
            'history_id': history.id
        })

    # 2. Beğeni Bildirimleri (PostLike)
    # Kullanıcının sorularına (History) gelen beğeniler - Community postları hariç
    post_likes = db.session.query(PostLike, User, History, Conversation)\
        .join(User, PostLike.user_id == User.id)\
        .join(History, PostLike.history_id == History.id)\
        .join(Conversation, History.conversation_id == Conversation.id)\
        .filter(Conversation.user_id == user.id)\
        .filter(PostLike.user_id != user.id)\
        .filter(History.selected_model != 'Community')\
        .order_by(PostLike.timestamp.desc())\
        .limit(20)\
        .all()

    for like, liker, history, conversation in post_likes:
        results.append({
            'id': f"plike-{like.id}",
            'type': 'like',
            'author': liker.display_name,
            'message': f"{liker.display_name} liked your post!",
            'question_title': conversation.title,
            'created_at': like.timestamp.strftime('%Y-%m-%d %H:%M'),
            'timestamp_obj': like.timestamp,
            'conversation_id': conversation.id,
            'history_id': history.id
        })

    # 3. Yorum Beğeni Bildirimleri (AnswerLike)
    # Kullanıcının cevaplarına (Answer) gelen beğeniler
    answer_likes = db.session.query(AnswerLike, User, Answer, History, Conversation)\
        .join(User, AnswerLike.user_id == User.id)\
        .join(Answer, AnswerLike.answer_id == Answer.id)\
        .join(History, Answer.history_id == History.id)\
        .join(Conversation, History.conversation_id == Conversation.id)\
        .filter(Answer.author_id == user.id)\
        .filter(AnswerLike.user_id != user.id)\
        .order_by(AnswerLike.timestamp.desc())\
        .limit(20)\
        .all()

    for like, liker, answer, history, conversation in answer_likes:
        results.append({
            'id': f"alike-{like.id}",
            'type': 'like',
            'author': liker.display_name,
            'message': f"{liker.display_name} liked your comment!",
            'question_title': conversation.title,
            'created_at': like.timestamp.strftime('%Y-%m-%d %H:%M'),
            'timestamp_obj': like.timestamp,
            'conversation_id': conversation.id,
            'answer_id': answer.id,
            'history_id': history.id
        })

    # 4. Notification tablosundan tüm bildirimler (follow, like, comment)
    all_notifications = Notification.query.filter_by(user_id=user.id)\
        .order_by(Notification.created_at.desc())\
        .limit(30)\
        .all()
        
    for n in all_notifications:
        # Related user name bul
        related_user = db.session.get(User, n.related_user_id) if n.related_user_id else None
        author_name = related_user.display_name if related_user else "Birisi"
        
        # Emoji seç
        emoji = '🔔'
        if n.type == 'follow':
            emoji = '👥'
        elif n.type == 'like':
            emoji = '❤️'
        elif n.type == 'comment':
            emoji = '💬'
        
        results.append({
            'id': f"notif-{n.id}",
            'real_id': n.id,
            'type': n.type,
            'author': author_name,
            'message': n.message,
            'related_user_id': n.related_user_id,
            'question_title': '',
            'created_at': n.created_at.strftime('%Y-%m-%d %H:%M'),
            'timestamp_obj': n.created_at,
            'conversation_id': None,
            'history_id': n.related_post_id,
            'is_new_system': True
        })

    # Okunmuş bildirimleri al
    read_notifications = {n.notification_id for n in NotificationRead.query.filter_by(user_id=user.id).all()}
    # Silinmiş bildirimleri al
    hidden_notifications = {n.notification_id for n in NotificationHidden.query.filter_by(user_id=user.id).all()}

    # Tarihe göre sırala (En yeni en üstte)
    results.sort(key=lambda x: x['timestamp_obj'], reverse=True)
    
    final_results = []
    # Timestamp objesini JSON için kaldır ve is_read ekle
    for r in results:
        # Gizlenmiş bildirimleri atla
        if r['id'] in hidden_notifications:
            continue
            
        # Tüm bildirimler için NotificationRead tablosunu kullan
        r['is_read'] = r['id'] in read_notifications
              
        if 'timestamp_obj' in r:
            del r['timestamp_obj']
            
        final_results.append(r)

    return jsonify(final_results)


@app.route('/api/notifications/read', methods=['POST'])
@jwt_required()
def mark_notification_read():
    user = get_current_user()
    data = request.json
    notification_id = data.get('notification_id')
    
    if not notification_id:
        return jsonify({'error': 'Notification ID required'}), 400
        
    # Zaten okunmuş mu?
    existing = NotificationRead.query.filter_by(user_id=user.id, notification_id=notification_id).first()
    if not existing:
        new_read = NotificationRead(user_id=user.id, notification_id=notification_id)
        db.session.add(new_read)
        db.session.commit()
        
    return jsonify({'status': 'marked_read'})


@app.route('/api/notifications/delete', methods=['POST'])
@jwt_required()
def delete_notification():
    user = get_current_user()
    data = request.json
    notification_id = data.get('notification_id')
    
    if not notification_id:
        return jsonify({'error': 'Notification ID required'}), 400
        
    # Zaten silinmiş mi?
    existing = NotificationHidden.query.filter_by(user_id=user.id, notification_id=notification_id).first()
    if not existing:
        new_hidden = NotificationHidden(user_id=user.id, notification_id=notification_id)
        db.session.add(new_hidden)
        db.session.commit()
        
    return jsonify({'status': 'deleted'})
@app.route('/api/history', methods=['GET'])
def get_history():
    items = History.query.order_by(History.timestamp.desc()).limit(20).all()
    return jsonify({'history':[serialize_history(h) for h in items]})


@app.route('/api/popular', methods=['GET'])
def get_popular():
    items = History.query.order_by(History.likes.desc(), History.timestamp.desc()).limit(5).all()
    return jsonify({'popular':[serialize_history(h) for h in items]})


from models import db, User, Conversation, History, Answer, PostLike, AnswerLike, NotificationRead, NotificationHidden

# ... (existing imports)

@app.route('/api/history/<int:history_id>/like', methods=['POST'])
@jwt_required()
def like_history(history_id: int):
    history = History.query.get_or_404(history_id)
    user = get_current_user()
    
    # Check if already liked
    existing_like = PostLike.query.filter_by(user_id=user.id, history_id=history_id).first()
    if existing_like:
        # Unlike
        db.session.delete(existing_like)
        history.likes = max((history.likes or 0) - 1, 0)
        db.session.commit()
        return jsonify({'likes': history.likes, 'status': 'unliked'})

    # Add like record
    new_like = PostLike(user_id=user.id, history_id=history_id)
    db.session.add(new_like)
    
    # Increment counter
    history.likes = (history.likes or 0) + 1
    
    # Bildirim oluştur (gönderi sahibine)
    if history.conversation and history.conversation.user_id and history.conversation.user_id != user.id:
        notification = Notification(
            user_id=history.conversation.user_id,
            type='like',
            message=f'{user.display_name} gönderinizi beğendi',
            related_user_id=user.id,
            related_post_id=history_id
        )
        db.session.add(notification)
    
    db.session.commit()
    return jsonify({'likes': history.likes, 'status': 'liked'})


@app.route('/api/answers/<int:answer_id>/like', methods=['POST'])
@jwt_required()
def like_answer(answer_id: int):
    answer = Answer.query.get_or_404(answer_id)
    user = get_current_user()

    # Check if already liked
    existing_like = AnswerLike.query.filter_by(user_id=user.id, answer_id=answer_id).first()
    if existing_like:
        # Unlike
        db.session.delete(existing_like)
        answer.likes = max((answer.likes or 0) - 1, 0)
        db.session.commit()
        return jsonify({'likes': answer.likes, 'status': 'unliked'})

    # Add like record
    new_like = AnswerLike(user_id=user.id, answer_id=answer_id)
    db.session.add(new_like)

    # Increment counter
    answer.likes = (answer.likes or 0) + 1
    
    # Bildirim oluştur (yorum sahibine)
    if answer.author_id and answer.author_id != user.id:
        notification = Notification(
            user_id=answer.author_id,
            type='like',
            message=f'{user.display_name} yorumunuzu beğendi',
            related_user_id=user.id,
            related_post_id=answer.history_id
        )
        db.session.add(notification)
    
    db.session.commit()
    return jsonify({'likes': answer.likes, 'status': 'liked'})


@app.route('/api/history/<int:history_id>', methods=['DELETE'])
def delete_history(history_id: int):
    history = History.query.get_or_404(history_id)
    db.session.delete(history)
    db.session.commit()
    return jsonify({'status': 'deleted'})


@app.route('/api/history/<int:history_id>/answers', methods=['GET'])
def list_answers(history_id: int):
    History.query.get_or_404(history_id)
    answers = Answer.query.filter_by(history_id=history_id)\
        .order_by(Answer.likes.desc(), Answer.created_at.desc()).all()
    return jsonify({'answers': [serialize_answer(a) for a in answers]})


@app.route('/api/history/<int:history_id>/similar', methods=['GET'])
def get_similar_questions(history_id: int):
    """Benzer topluluk sorularını bul ve döndür."""
    # Mevcut soruyu al
    current_history = History.query.get_or_404(history_id)
    current_question = (current_history.user_question or '').lower().strip()
    
    if not current_question:
        return jsonify({'similar': []})
    
    # Anahtar kelimeleri çıkar (stop words hariç)
    stop_words = {'bir', 'bu', 've', 'de', 'da', 'ile', 'için', 'mi', 'mı', 'mu', 'mü',
                  'ne', 'nasıl', 'neden', 'kim', 'nerede', 'hangi', 'kaç', 'ben', 'sen',
                  'o', 'biz', 'siz', 'onlar', 'var', 'yok', 'olarak', 'gibi', 'daha',
                  'çok', 'en', 'az', 'olan', 'the', 'a', 'an', 'is', 'are', 'in', 'on',
                  'to', 'for', 'of', 'and', 'or', 'how', 'what', 'why', 'where', 'when',
                  'bana', 'sana', 'ona', 'bize', 'size', 'onlara', 'beni', 'seni', 'onu', 
                  'bizi', 'sizi', 'onları', 'benim', 'senin', 'onun', 'bizim', 'sizin', 'onların',
                  'yap', 'et', 'iste', 'soru', 'cevap', 'çözüm', 'bunu', 'şunu', 'böyle', 'şöyle'}
    
    # Kelimeleri ayır ve filtrele
    words = [w for w in current_question.split() if len(w) > 2 and w not in stop_words]
    
    if not words:
        return jsonify({'similar': []})
    
    # Sadece Community postlarından ara (mevcut soru hariç)
    community_posts = History.query.filter(
        History.selected_model == 'Community',
        History.id != history_id
    ).order_by(History.timestamp.desc()).limit(100).all()
    
    similar = []
    for post in community_posts:
        post_question = (post.user_question or '').lower()
        # Kaç anahtar kelime eşleşiyor?
        match_count = sum(1 for word in words if word in post_question)
        if match_count > 0:
            similar.append({
                'post': serialize_history(post),
                'match_score': match_count
            })
    
    # En çok eşleşen 5 tanesini döndür
    similar.sort(key=lambda x: x['match_score'], reverse=True)
    top_similar = [item['post'] for item in similar[:5]]
    
    return jsonify({'similar': top_similar})


@app.route('/api/history/<int:history_id>/answers', methods=['POST'])
@jwt_required()
def create_answer(history_id: int):
    try:
        history = History.query.get_or_404(history_id)
        # Use silent=True to avoid 400 error if content-type is multipart/form-data
        data = request.get_json(silent=True) or {}
        user = get_current_user()
        
        # Handle both JSON and Form Data
        if request.content_type and 'multipart/form-data' in request.content_type:
            body = (request.form.get('body') or '').strip()
            code_snippet = request.form.get('code_snippet', '')
        else:
            # Fallback to JSON
            body = (data.get('body') or '').strip()
            code_snippet = data.get('code_snippet', '')

        if not body:
            return jsonify({'error': 'Answer text cannot be empty'}), 400

        image_path = None
        if request.files and 'image' in request.files:
            image_file = request.files['image']
            if image_file and image_file.filename:
                try:
                    filename = secure_filename(f"ans_{int(time.time())}_{image_file.filename}")
                    image_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                    image_file.save(image_path)
                except Exception as e:
                    print(f"File upload error: {e}")
                    return jsonify({'error': f'Failed to upload file: {str(e)}'}), 500

        answer = Answer(
            history_id=history_id,
            author_id=user.id,
            author=user.display_name,
            body=body,
            code_snippet=code_snippet,
            image_path=image_path
        )
        db.session.add(answer)
        
        # Bildirim oluştur (gönderi sahibine)
        if history.conversation and history.conversation.user_id and history.conversation.user_id != user.id:
            try:
                notification = Notification(
                    user_id=history.conversation.user_id,
                    type='comment',
                    message=f'{user.display_name} gönderinize çözüm ekledi',
                    related_user_id=user.id,
                    related_post_id=history_id
                )
                db.session.add(notification)
            except Exception as ne:
                print(f"Notification error (ignored): {ne}")
        
        db.session.commit()
        return jsonify({'answer': serialize_answer(answer)}), 201
        
    except Exception as e:
        db.session.rollback()
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'An error occurred: {str(e)}'}), 500





@app.route('/api/answers/<int:answer_id>', methods=['DELETE'])
@jwt_required()
@jwt_required()
def delete_answer(answer_id: int):
    answer = Answer.query.get_or_404(answer_id)
    user = get_current_user()
    if user.id != answer.author_id and not user.is_admin:
        return jsonify({'error': 'You do not have permission to delete this answer.'}), 403
    db.session.delete(answer)
    db.session.commit()
    return jsonify({'status': 'deleted'})


@app.route('/api/community/posts/<int:history_id>', methods=['GET'])
def get_community_post(history_id):
    # Public endpoint for community posts
    item = History.query.get_or_404(history_id)
    if item.selected_model != 'Community':
        return jsonify({'error': 'This is not a community post'}), 404
    
    return jsonify(serialize_history(item))


@app.route('/api/community/posts', methods=['POST'])
@jwt_required()
def create_community_post():
    user = get_current_user()
    
    # Handle multipart/form-data
    if request.content_type and 'multipart/form-data' in request.content_type:
        title = (request.form.get('title') or '').strip()
        code = request.form.get('code', '')
        solution = (request.form.get('solution') or '').strip()
        
        image_path = None
        if request.files and 'image' in request.files:
            image_file = request.files['image']
            if image_file and image_file.filename:
                filename = secure_filename(f"comm_{int(time.time())}_{image_file.filename}")
                image_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                image_file.save(image_path)
    else:
        # JSON fallback
        data = request.json or {}
        title = (data.get('title') or '').strip()
        code = data.get('code', '')
        solution = (data.get('solution') or '').strip()
        image_path = None

    if not title:
        return jsonify({'error': 'Title/Question required.'}), 400

    # 1. Create Conversation
    conversation = Conversation(user_id=user.id, title=title[:50])
    db.session.add(conversation)
    db.session.commit()

    # 2. Create History Item (The "Question")
    history = History(
        conversation_id=conversation.id,
        user_question=title,
        code_snippet=code,
        ai_response="This is a community post. You can check the solutions below.",
        selected_model='Community',
        summary=title[:50],
        image_path=image_path
    )
    db.session.add(history)
    db.session.commit()

    # 3. Create Answer (Optional "Solution")
    if solution:
        answer = Answer(
            history_id=history.id,
            author_id=user.id,
            author=user.display_name,
            body=solution,
            code_snippet=code if not image_path else None # If image is main content, code might be secondary, but logic remains same
        )
        db.session.add(answer)
        db.session.commit()

    return jsonify({
        'status': 'success',
        'history_id': history.id,
        'conversation_id': conversation.id
    }), 201


@app.route('/api/community/feed', methods=['GET'])
def get_community_feed():
    # Sadece 'Community' olarak işaretlenmiş postları getir
    items = History.query.filter_by(selected_model='Community')\
        .order_by(History.timestamp.desc())\
        .limit(50)\
        .all()
    
    # Kullanıcı giriş yapmış mı kontrol et
    user_id = None
    followed_ids = set()
    liked_post_ids = set()
    try:
        verify_jwt_in_request(optional=True)
        identity = get_jwt_identity()
        if identity:
            user_id = int(identity)
            # Takip edilenleri al
            followed_ids = {f.following_id for f in UserFollow.query.filter_by(follower_id=user_id).all()}
            # Beğenilen postları al
            liked_post_ids = {l.history_id for l in PostLike.query.filter_by(user_id=user_id).all()}
    except Exception:
        pass

    feed_data = []
    for h in items:
        data = serialize_history(h)
        # Takip durumu ekle
        if data['author_id'] and user_id and data['author_id'] != user_id:
             data['is_following'] = data['author_id'] in followed_ids
        else:
             data['is_following'] = False
        # Beğeni durumu ekle
        data['user_has_liked'] = h.id in liked_post_ids
        feed_data.append(data)

    return jsonify({'feed': feed_data})


@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)


# ========== SNIPPET ENDPOINTS ==========

@app.route('/api/snippets', methods=['GET'])
@jwt_required()
def list_snippets():
    """List user's saved code snippets."""
    user = get_current_user()
    snippets = Snippet.query.filter_by(user_id=user.id)\
        .order_by(Snippet.created_at.desc()).all()
    
    return jsonify({'snippets': [{
        'id': s.id,
        'title': s.title,
        'code': s.code,
        'language': s.language,
        'created_at': s.created_at.strftime('%Y-%m-%d %H:%M')
    } for s in snippets]})


@app.route('/api/snippets', methods=['POST'])
@jwt_required()
def create_snippet():
    """Save new code snippet."""
    user = get_current_user()
    data = request.json or {}
    
    title = (data.get('title') or '').strip()
    code = data.get('code') or ''
    language = data.get('language') or 'plaintext'
    
    if not title or not code:
        return jsonify({'error': 'Title and code required.'}), 400
    
    snippet = Snippet(
        user_id=user.id,
        title=title,
        code=code,
        language=language
    )
    db.session.add(snippet)
    db.session.commit()
    
    return jsonify({
        'status': 'success',
        'snippet': {
            'id': snippet.id,
            'title': snippet.title,
            'code': snippet.code,
            'language': snippet.language,
            'created_at': snippet.created_at.strftime('%Y-%m-%d %H:%M')
        }
    }), 201


@app.route('/api/snippets/<int:snippet_id>', methods=['DELETE'])
@jwt_required()
def delete_snippet(snippet_id):
    """Delete code snippet."""
    user = get_current_user()
    snippet = Snippet.query.filter_by(id=snippet_id, user_id=user.id).first_or_404()
    
    db.session.delete(snippet)
    db.session.commit()
    
    return jsonify({'status': 'deleted'})


# ==========================================
# KULLANICI TAKİP SİSTEMİ
# ==========================================

@app.route('/api/users/<int:user_id>/follow', methods=['POST'])
@jwt_required()
def follow_user(user_id):
    """Follow user."""
    current_user = get_current_user()
    
    # Kendini takip edemez
    if current_user.id == user_id:
        return jsonify({'error': 'You cannot follow yourself'}), 400
    
    # Takip edilecek kullanıcı var mı?
    target_user = db.session.get(User, user_id)
    if not target_user:
        return jsonify({'error': 'User not found'}), 404
    
    # Zaten takip ediyor mu?
    existing_follow = UserFollow.query.filter_by(
        follower_id=current_user.id, 
        following_id=user_id
    ).first()
    
    if existing_follow:
        return jsonify({'error': 'You are already following this user'}), 400
    
    # Takip et
    follow = UserFollow(follower_id=current_user.id, following_id=user_id)
    db.session.add(follow)
    
    # Bildirim oluştur (Eğer daha önce benzer bir bildirim yoksa)
    existing_notification = Notification.query.filter_by(
        user_id=user_id,
        type='follow',
        related_user_id=current_user.id
    ).first()

    if not existing_notification:
        notification = Notification(
            user_id=user_id,  # Takip edilen kullanıcıya bildirim
            type='follow',
            message=f'{current_user.display_name} started following you',
            related_user_id=current_user.id
        )
        db.session.add(notification)
    
    db.session.commit()
    
    return jsonify({
        'status': 'followed',
        'message': f'{target_user.display_name} is being followed'
    })


@app.route('/api/users/<int:user_id>/follow', methods=['DELETE'])
@jwt_required()
def unfollow_user(user_id):
    """Unfollow user."""
    current_user = get_current_user()
    
    follow = UserFollow.query.filter_by(
        follower_id=current_user.id, 
        following_id=user_id
    ).first()
    
    if not follow:
        return jsonify({'error': 'You are not following this user'}), 400
    
    db.session.delete(follow)
    db.session.commit()
    
    return jsonify({'status': 'unfollowed'})


@app.route('/api/users/<int:user_id>/followers', methods=['GET'])
def get_followers(user_id):
    """List user's followers."""
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    followers = UserFollow.query.filter_by(following_id=user_id).all()
    
    return jsonify({
        'followers': [
            {
                'id': f.follower.id,
                'display_name': f.follower.display_name,
                'profile_image': f"/uploads/{os.path.basename(f.follower.profile_image)}" if f.follower.profile_image else None,
                'followed_at': f.created_at.strftime('%Y-%m-%d %H:%M')
            }
            for f in followers
        ],
        'count': len(followers)
    })


@app.route('/api/users/<int:user_id>/following', methods=['GET'])
def get_following(user_id):
    """List user's following."""
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    following = UserFollow.query.filter_by(follower_id=user_id).all()
    
    return jsonify({
        'following': [
            {
                'id': f.following.id,
                'display_name': f.following.display_name,
                'profile_image': f"/uploads/{os.path.basename(f.following.profile_image)}" if f.following.profile_image else None,
                'followed_at': f.created_at.strftime('%Y-%m-%d %H:%M')
            }
            for f in following
        ],
        'count': len(following)
    })


@app.route('/api/users/<int:user_id>/profile', methods=['GET'])
def get_user_profile(user_id):
    """Get user profile info."""
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Takipçi ve takip sayıları
    followers_count = UserFollow.query.filter_by(following_id=user_id).count()
    following_count = UserFollow.query.filter_by(follower_id=user_id).count()
    
    # Mevcut kullanıcı takip ediyor mu?
    is_following = False
    current_user = get_current_user()
    if current_user:
        is_following = UserFollow.query.filter_by(
            follower_id=current_user.id, 
            following_id=user_id
        ).first() is not None
    
    # Kullanıcının gönderileri (Sadece Community postları)
    posts = History.query.join(Conversation).filter(
        Conversation.user_id == user_id,
        History.selected_model == 'Community'  # Sadece topluluk gönderileri
    ).order_by(History.timestamp.desc()).limit(10).all()
    
    # Serialize user with proper profile_image path
    user_data = serialize_user(user)
    user_data.update({
        'followers_count': followers_count,
        'following_count': following_count,
        'is_following': is_following
    })
    
    return jsonify({
        'user': user_data,
        'posts': [serialize_history(h) for h in posts]
    })


@app.route('/api/feed/following', methods=['GET'])
@jwt_required()
def get_following_feed():
    """Get following users' feed."""
    current_user = get_current_user()
    
    # Takip edilen kullanıcı ID'leri
    following_ids = [f.following_id for f in UserFollow.query.filter_by(follower_id=current_user.id).all()]
    
    if not following_ids:
        return jsonify({'feed': [], 'message': 'You are not following anyone yet'})
    
    # Takip edilenlerin gönderileri
    # Sadece 'Community' olarak işaretlenmiş (paylaşılmış) gönderileri getir
    posts = History.query.join(Conversation).filter(
        Conversation.user_id.in_(following_ids)
    ).filter(
        History.selected_model == 'Community'
    ).order_by(History.timestamp.desc()).limit(50).all()
    
    feed_data = []
    for h in posts:
        if h.conversation and h.conversation.user:
            item_data = serialize_history(h)
            is_liked = False
            if current_user:
                like_check = PostLike.query.filter_by(user_id=current_user.id, history_id=h.id).first()
                if like_check: is_liked = True
            item_data['is_liked'] = is_liked
            item_data['author'] = {
                'id': h.conversation.user.id,
                'display_name': h.conversation.user.display_name,
                'profile_image': f"/uploads/{os.path.basename(h.conversation.user.profile_image)}" if h.conversation.user.profile_image else None
            }
            feed_data.append(item_data)
    return jsonify({'feed': feed_data})

    # Legacy code (unreachable)
    return jsonify({
        'feed': [
            {
                **serialize_history(h),
                'author': {
                    'id': h.conversation.user.id if h.conversation.user else None,
                    'display_name': h.conversation.user.display_name if h.conversation.user else 'Anonymous',
                    'profile_image': f"/uploads/{os.path.basename(h.conversation.user.profile_image)}" if h.conversation.user and h.conversation.user.profile_image else None
                }
            }
            for h in posts if h.conversation and h.conversation.user
        ]
    })


@app.route('/api/notifications/all', methods=['GET'])
@jwt_required()
def get_all_notifications():
    """Kullanıcının tüm bildirimlerini getir (eski + yeni format)."""
    current_user = get_current_user()
    
    # Yeni format bildirimler (Notification tablosu)
    notifications = Notification.query.filter_by(user_id=current_user.id)\
        .order_by(Notification.created_at.desc())\
        .limit(50)\
        .all()
    
    return jsonify({
        'notifications': [
            {
                'id': n.id,
                'type': n.type,
                'message': n.message,
                'is_read': n.is_read,
                'related_user_id': n.related_user_id,
                'related_post_id': n.related_post_id,
                'created_at': n.created_at.strftime('%Y-%m-%d %H:%M')
            }
            for n in notifications
        ]
    })


@app.route('/api/notifications/<int:notification_id>/read', methods=['POST'])
@jwt_required()
def mark_single_notification_read(notification_id):
    """Bildirimi okundu olarak işaretle."""
    current_user = get_current_user()
    
    notification = Notification.query.filter_by(
        id=notification_id, 
        user_id=current_user.id
    ).first()
    
    if not notification:
        return jsonify({'error': 'Notification not found'}), 404
    
    notification.is_read = True
    db.session.commit()
    
    return jsonify({'status': 'read'})


@app.route('/api/debug/init-db', methods=['POST'])
def init_db():
    try:
        from models import db
        with app.app_context():
            db.create_all()
        return jsonify({'status': 'Database initialized'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============================================
# FAVORITES API
# ============================================

@app.route('/api/favorites', methods=['GET'])
@jwt_required()
def get_favorites():
    """Kullanıcının favori yanıtlarını getir"""
    identity = get_jwt_identity()
    current_user = User.query.get(int(identity))
    if not current_user:
        return jsonify({'error': 'User not found'}), 404
    
    favorites = Favorite.query.filter_by(user_id=current_user.id).order_by(Favorite.created_at.desc()).all()
    
    result = []
    for fav in favorites:
        history = History.query.get(fav.history_id)
        if history:
            conversation = Conversation.query.get(history.conversation_id)
            result.append({
                'id': fav.id,
                'history_id': history.id,
                'user_question': history.user_question,
                'ai_response': history.ai_response,
                'code_snippet': history.code_snippet,
                'model': history.selected_model,
                'conversation_title': conversation.title if conversation else None,
                'created_at': fav.created_at.isoformat()
            })
    
    return jsonify(result)


@app.route('/api/favorites/<int:history_id>', methods=['POST'])
@jwt_required()
def add_favorite(history_id):
    """Yanıtı favorilere ekle"""
    identity = get_jwt_identity()
    current_user = User.query.get(int(identity))
    
    if not current_user:
        return jsonify({'error': f'User not found for identity: {identity}'}), 404
    
    history = History.query.get(history_id)
    if not history:
        return jsonify({'error': 'History not found'}), 404
    
    # Zaten favoride mi kontrol et
    existing = Favorite.query.filter_by(user_id=current_user.id, history_id=history_id).first()
    if existing:
        return jsonify({'status': 'added', 'id': existing.id, 'message': 'Already in favorites'}), 200
    
    favorite = Favorite(user_id=current_user.id, history_id=history_id)
    db.session.add(favorite)
    db.session.commit()
    
    return jsonify({'status': 'added', 'id': favorite.id})


@app.route('/api/favorites/<int:history_id>', methods=['DELETE'])
@jwt_required()
def remove_favorite(history_id):
    """Yanıtı favorilerden kaldır"""
    identity = get_jwt_identity()
    current_user = User.query.get(int(identity))

    if not current_user:
        return jsonify({'error': 'User not found'}), 404
    
    favorite = Favorite.query.filter_by(user_id=current_user.id, history_id=history_id).first()
    if not favorite:
        return jsonify({'status': 'removed', 'message': 'Not in favorites'}), 200
    
    db.session.delete(favorite)
    db.session.commit()
    
    return jsonify({'status': 'removed'})


@app.route('/api/favorites/check/<int:history_id>', methods=['GET'])
@jwt_required()
def check_favorite(history_id):
    """Yanıtın favoride olup olmadığını kontrol et"""
    current_user = User.query.filter_by(email=get_jwt_identity()).first()
    if not current_user:
        return jsonify({'error': 'User not found'}), 404
    
    favorite = Favorite.query.filter_by(user_id=current_user.id, history_id=history_id).first()
    return jsonify({'is_favorite': favorite is not None})

@app.route('/api/files/<filename>')
def serve_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)


@app.route('/')
def serve_index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def serve_static_files(path):
    """Serve static files or index.html for SPA"""
    file_path = os.path.join(app.static_folder, path)
    if os.path.exists(file_path):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, 'index.html')

if __name__ == '__main__':
    with app.app_context():
        # db.drop_all()  # Veritabanını sıfırlamak istemiyoruz
        db.create_all()

    app.run(debug=True)