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
            const target = textRef.current;
            const currentLength = displayedText.length;
            const diff = target.length - currentLength;

            if (diff <= 0) return;

            // Throttle: Don't update on every frame if the UI is struggling
            if (currentTime - lastTime < 16) { // ~60fps target
                animationFrameId = requestAnimationFrame(animate);
                return;
            }

            let charsToAdd = 1;
            const speedMultiplier = isActive ? 1 : 4; // Faster finish once stream is done

            // Optimize: Batching for performance when lagging behind
            if (diff > 1000) charsToAdd = 50 * speedMultiplier;
            else if (diff > 500) charsToAdd = 25 * speedMultiplier;
            else if (diff > 100) charsToAdd = 10 * speedMultiplier;
            else if (diff > 20) charsToAdd = 3 * speedMultiplier;

            if (charsToAdd > 0) {
                setDisplayedText(target.slice(0, currentLength + charsToAdd));
                lastTime = currentTime;
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
