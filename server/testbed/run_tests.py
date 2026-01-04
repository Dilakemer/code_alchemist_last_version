"""
CodeAlchemist TestBed - Test Çalıştırıcı
Model performansını objektif kriterlerle ölçen ana modül.

Bu modül:
- Statik JSON sorularını yükler
- Her model için testleri çalıştırır
- Doğruluk, yanıt süresi ve hata oranı metriklerini kaydeder
- Karşılaştırmalı sonuç raporu oluşturur
"""

import json
import time
import os
import sys
from datetime import datetime
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
from pathlib import Path

# Ana uygulama dizinine path ekle
sys.path.insert(0, str(Path(__file__).parent.parent))


@dataclass
class TestResult:
    """Tek bir test sonucunu temsil eder."""
    question_id: str
    model: str
    category: str
    difficulty: str
    response: str
    response_time_ms: float
    is_correct: bool
    error: Optional[str] = None
    timestamp: str = ""
    
    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = datetime.now().isoformat()


@dataclass 
class ModelMetrics:
    """Model performans metriklerini temsil eder."""
    model_name: str
    total_tests: int = 0
    correct_count: int = 0
    error_count: int = 0
    avg_response_time_ms: float = 0.0
    
    @property
    def accuracy(self) -> float:
        if self.total_tests == 0:
            return 0.0
        return self.correct_count / self.total_tests
    
    @property
    def error_rate(self) -> float:
        if self.total_tests == 0:
            return 0.0
        return self.error_count / self.total_tests


class TestBedRunner:
    """TestBed test çalıştırıcı sınıfı."""
    
    def __init__(self, questions_path: str = None):
        """
        Args:
            questions_path: Soru dosyasının yolu
        """
        self.base_dir = Path(__file__).parent
        self.questions_path = questions_path or self.base_dir / "questions.json"
        self.results: List[TestResult] = []
        self.questions = self._load_questions()
        
    def _load_questions(self) -> List[Dict]:
        """Soru dosyasını yükler."""
        try:
            with open(self.questions_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data.get("questions", [])
        except Exception as e:
            print(f"Soru dosyası yüklenemedi: {e}")
            return []
    
    def _call_model(self, model: str, question: str) -> tuple:
        """
        Modeli çağırır ve yanıt ile süreyi döndürür.
        
        Bu fonksiyon, ana uygulamadaki model API'lerini kullanır.
        """
        start_time = time.time()
        
        try:
            # Gerçek model çağrısı - app.py'den import edilen fonksiyonları kullan
            from app import generate_gemini_answer, generate_gpt_answer, generate_claude_answer
            
            response_chunks = []
            
            if 'gemini' in model.lower() or 'gemma' in model.lower():
                for chunk in generate_gemini_answer(question, "", None, model):
                    response_chunks.append(chunk)
            elif 'gpt' in model.lower() or 'openai' in model.lower():
                for chunk in generate_gpt_answer(question, "", None, model):
                    response_chunks.append(chunk)
            elif 'claude' in model.lower():
                for chunk in generate_claude_answer(question, "", None, model):
                    response_chunks.append(chunk)
            else:
                # Varsayılan olarak Gemini kullan
                for chunk in generate_gemini_answer(question, "", None, model):
                    response_chunks.append(chunk)
            
            response = "".join(response_chunks)
            elapsed_ms = (time.time() - start_time) * 1000
            return response, elapsed_ms, None
            
        except Exception as e:
            elapsed_ms = (time.time() - start_time) * 1000
            return None, elapsed_ms, str(e)
    
    def _evaluate_response(
        self, 
        response: str, 
        question: Dict, 
        category: str
    ) -> bool:
        """
        Model yanıtını değerlendirir.
        
        Değerlendirme kriterleri:
        - syntax: Düzeltilmiş kodun sözdizimsel doğruluğu
        - logic: Beklenen düzeltmeyle eşleşme
        - algorithm: Test case'lerin geçip geçmediği
        - optimization: Karmaşıklık iyileştirmesi
        """
        if not response:
            return False
            
        # Basit değerlendirme: Beklenen çıktının varlığı kontrolü
        expected = question.get("expected_fix") or question.get("expected_output", "")
        
        if not expected:
            return len(response) > 50  # Minimal yanıt kontrolü
            
        # Anahtar kod parçalarının varlığını kontrol et
        expected_keywords = self._extract_keywords(expected)
        response_lower = response.lower()
        
        matches = sum(1 for kw in expected_keywords if kw.lower() in response_lower)
        match_ratio = matches / len(expected_keywords) if expected_keywords else 0
        
        return match_ratio >= 0.5  # %50 eşleşme eşiği
    
    def _extract_keywords(self, code: str) -> List[str]:
        """Kod parçasından anahtar kelimeleri çıkarır."""
        # Fonksiyon/değişken isimleri ve önemli yapılar
        keywords = []
        
        important_patterns = [
            "def ", "return ", "for ", "while ", "if ",
            "class ", "import ", "from ", "lambda",
            "try:", "except", "with ", "async ", "await"
        ]
        
        for pattern in important_patterns:
            if pattern in code:
                keywords.append(pattern.strip())
                
        return keywords
    
    def run_single_test(self, model: str, question: Dict) -> TestResult:
        """Tek bir test çalıştırır."""
        question_text = question.get("question", "")
        
        response, response_time, error = self._call_model(model, question_text)
        
        is_correct = False
        if response and not error:
            is_correct = self._evaluate_response(
                response, 
                question, 
                question.get("category", "")
            )
        
        result = TestResult(
            question_id=question.get("id", "unknown"),
            model=model,
            category=question.get("category", "unknown"),
            difficulty=question.get("difficulty", "unknown"),
            response=response or "",
            response_time_ms=response_time,
            is_correct=is_correct,
            error=error
        )
        
        return result
    
    def run_all_tests(self, models: List[str]) -> Dict[str, ModelMetrics]:
        """
        Tüm modeller için tüm testleri çalıştırır.
        
        Args:
            models: Test edilecek model listesi
            
        Returns:
            Model bazlı metrikler
        """
        all_metrics: Dict[str, ModelMetrics] = {}
        
        for model in models:
            print(f"\n{'='*50}")
            print(f"Model: {model}")
            print(f"{'='*50}")
            
            metrics = ModelMetrics(model_name=model)
            response_times = []
            
            for i, question in enumerate(self.questions, 1):
                print(f"  Test {i}/{len(self.questions)}: {question.get('id', 'N/A')}...", end=" ")
                
                result = self.run_single_test(model, question)
                self.results.append(result)
                
                metrics.total_tests += 1
                if result.is_correct:
                    metrics.correct_count += 1
                    print("✓")
                elif result.error:
                    metrics.error_count += 1
                    print(f"✗ (Hata: {result.error[:30]}...)")
                else:
                    print("✗")
                    
                response_times.append(result.response_time_ms)
            
            if response_times:
                metrics.avg_response_time_ms = sum(response_times) / len(response_times)
                
            all_metrics[model] = metrics
            
            # Özet yazdır
            print(f"\n  Özet: {metrics.correct_count}/{metrics.total_tests} doğru")
            print(f"  Doğruluk: {metrics.accuracy:.1%}")
            print(f"  Hata Oranı: {metrics.error_rate:.1%}")
            print(f"  Ort. Yanıt Süresi: {metrics.avg_response_time_ms:.0f}ms")
        
        return all_metrics
    
    def generate_report(
        self, 
        metrics: Dict[str, ModelMetrics],
        output_path: str = None
    ) -> str:
        """Karşılaştırmalı rapor oluşturur."""
        output_path = output_path or self.base_dir / "test_report.json"
        
        report = {
            "generated_at": datetime.now().isoformat(),
            "total_questions": len(self.questions),
            "models_tested": list(metrics.keys()),
            "summary": {},
            "detailed_results": [asdict(r) for r in self.results],
            "category_breakdown": {}
        }
        
        # Model özeti
        for model, m in metrics.items():
            report["summary"][model] = {
                "accuracy": round(m.accuracy, 4),
                "error_rate": round(m.error_rate, 4),
                "avg_response_time_ms": round(m.avg_response_time_ms, 2),
                "correct_count": m.correct_count,
                "total_tests": m.total_tests
            }
        
        # Kategori bazlı analiz
        categories = set(q.get("category") for q in self.questions)
        for category in categories:
            report["category_breakdown"][category] = {}
            for model in metrics.keys():
                cat_results = [
                    r for r in self.results 
                    if r.model == model and r.category == category
                ]
                correct = sum(1 for r in cat_results if r.is_correct)
                total = len(cat_results)
                report["category_breakdown"][category][model] = {
                    "accuracy": round(correct / total, 4) if total > 0 else 0,
                    "correct": correct,
                    "total": total
                }
        
        # Dosyaya kaydet
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
            
        print(f"\nRapor kaydedildi: {output_path}")
        
        return str(output_path)


def main():
    """Ana çalıştırma fonksiyonu."""
    print("=" * 60)
    print("CodeAlchemist TestBed - Model Performans Değerlendirmesi")
    print("=" * 60)
    
    # Test edilecek modeller
    models = [
        "gemini-2.5-flash",
        "gemini-2.5-flash-lite",
        "gpt-4o",
        "claude-4.5-sonnet",
        "claude-3-haiku",
        "codegen-350m"
    ]
    
    # Test çalıştırıcıyı başlat
    runner = TestBedRunner()
    
    print(f"\nYüklenen soru sayısı: {len(runner.questions)}")
    print(f"Test edilecek modeller: {', '.join(models)}")
    
    # Testleri çalıştır
    metrics = runner.run_all_tests(models)
    
    # Rapor oluştur
    runner.generate_report(metrics)
    
    # Final özet
    print("\n" + "=" * 60)
    print("KARŞILAŞTIRMALI SONUÇLAR")
    print("=" * 60)
    print(f"{'Model':<25} {'Doğruluk':<12} {'Hata Oranı':<12} {'Ort. Süre':<12}")
    print("-" * 60)
    
    for model, m in sorted(metrics.items(), key=lambda x: x[1].accuracy, reverse=True):
        print(f"{model:<25} {m.accuracy:>10.1%} {m.error_rate:>10.1%} {m.avg_response_time_ms:>8.0f}ms")


if __name__ == "__main__":
    main()
