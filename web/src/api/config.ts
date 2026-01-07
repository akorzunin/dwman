// import { getAccessToken } from '../utils/auth';
import { OpenAPI } from './client';

// OpenAPI.TOKEN = getAccessToken;
OpenAPI.BASE = import.meta.env.VITE_API_URL || '';
