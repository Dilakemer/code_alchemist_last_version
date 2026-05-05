from locust import HttpUser, task, between
import random

class AlchemistUser(HttpUser):
    # ✅ Host'ta sondaki "/" OLMAMALI
    host = "http://localhost:5001"
    wait_time = between(1, 3)
    token = None

    def on_start(self):
        """Her sanal kullanıcı teste başlarken bir kez çalışır (login)"""
        with self.client.post(
            "/api/auth/login",   # ✅ Host'ta trailing slash yoksa bu doğru
            json={
                "email": "cey@gmail.com",
                "password": "Ceyda1234"
            },
            catch_response=True
        ) as response:
            if response.status_code == 200:
                data = response.json()
                self.token = data.get("token")
                
                if self.token:
                    self.client.headers.update({
                        "Authorization": f"Bearer {self.token}"
                    })
                    response.success()
                else:
                    # Response 200 ama token yoksa key adı farklıdır
                    response.failure(f"Token bulunamadı. Response: {data}")
            else:
                # ❌ Buraya düşüyorsa credentials veya URL yanlış
                response.failure(
                    f"Login başarısız | Status: {response.status_code} | Body: {response.text}"
                )

    @task(3)
    def send_message(self):
        """Chat endpoint yük testi"""
        if not self.token:
            return  # ✅ Token yoksa isteği hiç atma, hata üretme
        
        with self.client.post(
            "/api/ask",
            json={"question": "Bu bir yük testi mesajıdır."},
            catch_response=True
        ) as response:
            if response.status_code == 200:
                response.success()
            elif response.status_code == 401:
                response.failure("Yetkilendirme hatası — token geçersiz")
            else:
                response.failure(f"Chat hatası | Status: {response.status_code} | {response.text}")

    @task(1)
    def view_projects(self):
        """Projects endpoint yük testi"""
        if not self.token:
            return  # ✅ Token yoksa isteği atma
        
        with self.client.get(
            "/api/conversations",
            catch_response=True
        ) as response:
            if response.status_code == 200:
                response.success()
            elif response.status_code == 401:
                response.failure("Yetkilendirme hatası — token geçersiz")
            else:
                response.failure(f"Projects hatası | Status: {response.status_code} | {response.text}")