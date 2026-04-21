"""
Ana uygulama dosyası - Optimize edilmiş hesap makinesi demo.
"""
from calculator import add, divide, calculate_average
from typing import Callable, Any

def safe_execute(func: Callable, *args: Any, description: str = "İşlem") -> None:
    """Fonksiyonları güvenli bir şekilde çalıştırır ve hataları yakalar."""
    try:
        result = func(*args)
        print(f"✅ {description}: {result}")
    except ValueError as e:
        print(f"❌ {description} Hatası: {e}")
    except Exception as e:
        print(f"⚠️ {description} Beklenmeyen Hata: {e}")

def main():
    """Ana program akışı."""
    numbers = [10, 20, 30, 40]
    print("--- Hesap Makinesi Optimizasyon Testleri ---\n")

    # Toplama
    safe_execute(add, numbers[0], numbers[1], description="Toplam")
    
    # Ortalama
    safe_execute(calculate_average, numbers, description="Ortalama")
    
    # Güvenli Bölme
    safe_execute(divide, 10, 2, description="Bölme (10/2)")
    
    # Hatalı Bölme (Sıfıra Bölme)
    safe_execute(divide, 10, 0, description="Bölme (10/0)")

if __name__ == "__main__":
    main()
