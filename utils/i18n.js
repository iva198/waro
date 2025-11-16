// utils/i18n.js - Internationalization utility
const indonesia = require('../i18n/indonesia');

// Default language
const DEFAULT_LANGUAGE = 'id'; // Indonesian

// Supported languages
const SUPPORTED_LANGUAGES = {
  'id': indonesia,
  'indonesia': indonesia,
  'id-ID': indonesia
};

// Get messages based on language
const getMessages = (lang = DEFAULT_LANGUAGE) => {
  return SUPPORTED_LANGUAGES[lang] || SUPPORTED_LANGUAGES[DEFAULT_LANGUAGE];
};

// Function to get message by path (e.g., 'sales.created')
const getMessage = (path, lang = DEFAULT_LANGUAGE) => {
  const messages = getMessages(lang);
  const pathParts = path.split('.');
  let result = messages;
  
  for (const part of pathParts) {
    if (result && result[part] !== undefined) {
      result = result[part];
    } else {
      return path; // Return the path as fallback if message not found
    }
  }
  
  return result;
};

// Middleware to detect language from request
const detectLanguage = (req, res, next) => {
  // Check for language in query params, headers, or default to ID
  let lang = DEFAULT_LANGUAGE;
  
  if (req.query.lang) {
    lang = req.query.lang;
  } else if (req.headers['accept-language']) {
    // Extract first language from Accept-Language header
    lang = req.headers['accept-language'].split(',')[0].split(';')[0];
  }
  
  // Set the language for this request
  req.language = lang;
  req.t = (path) => getMessage(path, lang);
  
  next();
};

module.exports = {
  getMessages,
  getMessage,
  detectLanguage,
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES
};