/**
 * Script principal - Fonctions communes à toutes les pages
 */

// Configuration globale
const APP_CONFIG = {
    apiUrl: 'http://localhost:8000/api',
    mapCenter: [45.5, -73.6],
    mapZoom: 11
};

// Formater les nombres
function formatNumber(num) {
    return new Intl.NumberFormat('fr-FR').format(num);
}

// Formater les dates
function formatDate(dateString) {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
}

// Export des fonctions globales
if (typeof window !== 'undefined') {
    window.APP_CONFIG = APP_CONFIG;
    window.formatNumber = formatNumber;
    window.formatDate = formatDate;
}

console.log('✅ Main.js chargé');
