import { useState, useEffect, useRef } from 'react';

/**
 * Metni daktilo efektiyle yumuşak bir şekilde yazar.
 * @param {string} text - Görüntülenecek hedef metin
 * @param {boolean} isActive - Efektin çalışıp çalışmayacağı (genellikle loading durumu)
 * @param {number} minSpeed - Minimum yazma hızı (ms/karakter)
 * @param {number} maxSpeed - Maksimum yazma hızı (daha düşük değer = daha hızlı)
 */
export const useTypingEffect = (text, isActive, minSpeed = 20, maxSpeed = 1) => {
    const [displayedText, setDisplayedText] = useState('');
    const textRef = useRef(text);
    const hasStartedStreamingRef = useRef(false);

    // Metin veya aktiflik değiştiğinde çalışır
    useEffect(() => {
        // Reset durumu (yeni sohbet vs)
        if (text === '') {
            setDisplayedText('');
            textRef.current = '';
            hasStartedStreamingRef.current = false;
        } else {
            textRef.current = text;

            // Eğer şu an aktif bir stream varsa, bunu işaretle
            if (isActive) {
                hasStartedStreamingRef.current = true;
            }

            const isImage = text.includes('![') && text.includes('](');

            // Image detected: Render immediately regardless of active state
            if (isImage) {
                setDisplayedText(text);
                return;
            }

            // Eğer aktif değilse (isActive=false):
            if (!isActive) {
                // Eğer daha önce hiç stream edilmediyse (örn: sayfa yeni yüklendi, geçmiş mesajlar),
                // direkt metni göster. Animasyon yapma.
                if (!hasStartedStreamingRef.current) {
                    setDisplayedText(text);
                }
                // Eğer hasStartedStreamingRef=true ise (yani az önce yazıyorduk ve stream bitti),
                // BURADA HİÇBİR ŞEY YAPMA. 
                // Bırak aşağıdaki animasyon loop'u metni tamamlasın. 
                // Böylece "pat" diye belirme olmaz, yumuşakça biter.
            }
        }
    }, [text, isActive]);

    // Animasyon Loop'u
    useEffect(() => {
        // Hedefe ulaştıysak dur.
        if (displayedText.length === textRef.current.length) {
            return;
        }

        // Eğer stream hiç başlamadıysa ve aktif değilse (sayfa yükleme),
        // ve metinler eşleşmiyorsa, senkronize et (yukarıdaki useEffect kaçırırsa diye güvenlik)
        if (!isActive && !hasStartedStreamingRef.current && displayedText !== textRef.current) {
            setDisplayedText(textRef.current);
            return;
        }

        let animationFrameId;
        let lastTime = performance.now();

        const animate = (currentTime) => {
            const deltaTime = currentTime - lastTime;
            const target = textRef.current;
            const currentLength = displayedText.length;
            const diff = target.length - currentLength;

            if (diff <= 0) {
                return;
            }

            let charsToAdd = 0;

            // Dinamik Hız Ayarı (Catch-up Logic)
            // Stream bittiyse (isActive=false) ve hala gerideysek, kullanıcıyı çok bekletmemek için
            // hızı hafifçe artırabiliriz ama "pat" diye değil.

            const speedMultiplier = isActive ? 1 : 2; // Stream bittiyse 2x hızlan

            if (diff > 500) {
                charsToAdd = 10 * speedMultiplier;
            } else if (diff > 200) {
                charsToAdd = 5 * speedMultiplier;
            } else if (diff > 50) {
                charsToAdd = 2 * speedMultiplier;
            } else {
                // Normal akış
                if (deltaTime > (minSpeed / speedMultiplier)) {
                    charsToAdd = 1;
                    lastTime = currentTime;
                }
            }

            if (charsToAdd > 0) {
                setDisplayedText(prev => target.slice(0, prev.length + charsToAdd));
                // Reset timer only if adding multiple chars (burst)
                if (charsToAdd > 1) lastTime = currentTime;
            }

            animationFrameId = requestAnimationFrame(animate);
        };

        animationFrameId = requestAnimationFrame(animate);

        return () => {
            cancelAnimationFrame(animationFrameId);
        };
    }, [displayedText, isActive, minSpeed]);

    return displayedText;
};

export default useTypingEffect;
