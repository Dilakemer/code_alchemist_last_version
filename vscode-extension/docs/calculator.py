from typing import List, Union

# Number tipini tanımlıyoruz: Sayı hem tam sayı (int) hem de ondalıklı sayı (float) olabilir.
Number = Union[int, float]

def add(a: Number, b: Number) -> Number:
    """İki sayıyı toplar."""
    return a + b

def divide(a: Number, b: Number) -> float:
    """
    İki sayıyı böler.
    
    Args:
        a: Bölünen sayı
        b: Bölen sayı
        
    Returns:
        Bölme sonucu (float)
        
    Raises:
        ValueError: Bölen sıfır ise
    """
    if b == 0:
        raise ValueError("Bölen sıfır olamaz!")
    return float(a / b)

def calculate_average(numbers: List[Number]) -> float:
    """
    Sayı listesinin ortalamasını hesaplar.
    
    Args:
        numbers: Sayı listesi
        
    Returns:
        Ortalama değer (float)
        
    Raises:
        ValueError: Liste boş ise
    """
    if not numbers:
        raise ValueError("Liste boş olamaz!")
    
    total = sum(numbers)
    return divide(total, len(numbers))
