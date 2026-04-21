import React from 'react';
import PropTypes from 'prop-types';

/**
 * DemoCard - Modern ve erişilebilir kart bileşeni
 * 
 * @param {Object} props - Bileşen özellikleri
 * @param {string} props.title - Kart başlığı
 * @param {string} props.description - Kart açıklaması
 * @param {string} props.className - Ek CSS sınıfları
 */
const DemoCard = ({ 
  title = "Demo Kart", 
  description = "Bu basit bir React bileşenidir.",
  className = ""
}) => {
  return (
    <article 
      className={`p-6 max-w-sm mx-auto bg-white rounded-xl shadow-lg 
                  hover:shadow-xl transition-shadow duration-300
                  border border-gray-200 
                  sm:max-w-md md:max-w-lg ${className}`}
      role="article"
      aria-labelledby="demo-card-title"
    >
      <div className="space-y-2">
        <h2 
          id="demo-card-title"
          className="text-xl font-medium text-gray-900"
        >
          {title}
        </h2>
        <p className="text-slate-600 text-sm leading-relaxed">
          {description}
        </p>
      </div>
    </article>
  );
};

DemoCard.propTypes = {
  title: PropTypes.string,
  description: PropTypes.string,
  className: PropTypes.string
};

export default DemoCard;
