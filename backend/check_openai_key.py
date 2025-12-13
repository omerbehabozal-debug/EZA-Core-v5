#!/usr/bin/env python3
"""
OpenAI API Key Test Script
Bu script OpenAI API key'in çalışıp çalışmadığını test eder.
"""

import os
import sys
from dotenv import load_dotenv

# Load .env file
load_dotenv()

def test_openai_key():
    """Test OpenAI API key"""
    api_key = os.getenv("OPENAI_API_KEY")
    
    if not api_key:
        print("❌ OPENAI_API_KEY bulunamadı!")
        print("\n.env dosyasında veya environment variable'da OPENAI_API_KEY tanımlı olmalı.")
        return False
    
    # Check key format
    if not api_key.startswith("sk-"):
        print(f"⚠️  UYARI: API key 'sk-' ile başlamıyor. Key formatı yanlış olabilir.")
        print(f"   Key başlangıcı: {api_key[:10]}...")
    
    # Check key length (OpenAI keys are usually 51+ characters)
    if len(api_key) < 20:
        print(f"❌ API key çok kısa ({len(api_key)} karakter). Geçerli bir key değil.")
        return False
    
    print(f"✅ API Key bulundu!")
    print(f"   Key uzunluğu: {len(api_key)} karakter")
    print(f"   Key başlangıcı: {api_key[:10]}...")
    print(f"   Key sonu: ...{api_key[-4:]}")
    
    # Try to make a test API call using httpx (same as backend)
    try:
        import httpx
        import asyncio
        
        async def test_api_call():
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": "gpt-4o-mini",
                        "messages": [{"role": "user", "content": "Say hello"}],
                        "max_tokens": 10
                    }
                )
                return response
        
        print("\n🔄 OpenAI API'ye test isteği gönderiliyor...")
        
        response = asyncio.run(test_api_call())
        
        if response.status_code == 200:
            data = response.json()
            output = data["choices"][0]["message"]["content"]
            print("✅ API Key çalışıyor! Test başarılı.")
            print(f"   Model yanıtı: {output}")
            return True
        elif response.status_code == 401:
            print(f"❌ API Key geçersiz! Authentication hatası:")
            print(f"   Status: {response.status_code}")
            print(f"   Response: {response.text[:200]}")
            return False
        else:
            print(f"⚠️  API çağrısı başarısız:")
            print(f"   Status: {response.status_code}")
            print(f"   Response: {response.text[:200]}")
            return False
        
    except Exception as e:
        print(f"⚠️  API çağrısı sırasında hata:")
        print(f"   {type(e).__name__}: {str(e)}")
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("OpenAI API Key Test")
    print("=" * 60)
    print()
    
    success = test_openai_key()
    
    print()
    print("=" * 60)
    if success:
        print("✅ Test başarılı - API key çalışıyor!")
        sys.exit(0)
    else:
        print("❌ Test başarısız - API key'i kontrol edin!")
        print("\nYapılacaklar:")
        print("1. .env dosyasında OPENAI_API_KEY değişkenini kontrol edin")
        print("2. Railway'de environment variable'ı kontrol edin")
        print("3. API key'in doğru olduğundan emin olun")
        print("4. Backend'i restart edin")
        sys.exit(1)

