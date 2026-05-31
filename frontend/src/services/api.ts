import axios from 'axios';
import { BBox } from '../components/BboxCanvas';

const API_BASE_URL = 'http://127.0.0.1:8000/api';
const AUTH_BASE_URL = 'http://127.0.0.1:8000/api/auth';

// Add a request interceptor to attach JWT token
axios.interceptors.request.use(
    (config) => {
        if (typeof window !== 'undefined') {
            const token = localStorage.getItem('token');
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export const loginUser = async (credentials: any) => {
    // FastAPI OAuth2PasswordRequestForm expects form data
    const formData = new URLSearchParams();
    formData.append('username', credentials.username);
    formData.append('password', credentials.password);
    
    const response = await axios.post(`${AUTH_BASE_URL}/login`, formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    return response.data;
};

export const signupUser = async (userData: any) => {
    const response = await axios.post(`${AUTH_BASE_URL}/signup`, userData);
    return response.data;
};

export const getMe = async () => {
    const response = await axios.get(`${AUTH_BASE_URL}/me`);
    return response.data;
};

export interface BatchUploadResponse {
    document_ids: number[];
    file_paths: string[];
    filenames: string[];
    is_batch: boolean;
    is_cached: boolean;
    cached_corrected_json?: BBox[] | null;
}

export const uploadDocument = async (file: File): Promise<BatchUploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await axios.post(`${API_BASE_URL}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
};

export const processDocument = async (documentId: number, language: string, modality: string) => {
    const response = await axios.post(`${API_BASE_URL}/process?document_id=${documentId}&language=${language}&modality=${modality}`);
    return response.data;
};

export const saveAnnotation = async (ocrResultId: number, editedText: string) => {
    const response = await axios.post(`${API_BASE_URL}/save?ocr_result_id=${ocrResultId}`, {
        edited_text: editedText
    });
    return response.data;
};

export const saveBboxCorrections = async (
    documentId: number,
    correctedJson: BBox[],
    correctedText: string
) => {
    const response = await axios.post(
        `${API_BASE_URL}/save-corrections?document_id=${documentId}`,
        { corrected_json: correctedJson, corrected_text: correctedText }
    );
    return response.data;
};

export const getBestModel = async (documentId: number) => {
    const response = await axios.get(`${API_BASE_URL}/best-model/${documentId}`);
    return response.data;
};

export const getResults = async (documentId: number) => {
    const response = await axios.get(`${API_BASE_URL}/results/${documentId}`);
    return response.data;
};

export interface AnnotationLogCreate {
    action_type: string;
    previous_value?: string;
    updated_value?: string;
    timestamp?: string;
}

export interface StatisticsUpdateRequest {
    document_id: number;
    page_number: number;
    bbox_deleted: number;
    bbox_created: number;
    bbox_edited: number;
    text_edited: number;
    time_spent: number;
    logs: AnnotationLogCreate[];
}

export const saveStatistics = async (data: StatisticsUpdateRequest) => {
    const response = await axios.post(`${API_BASE_URL}/statistics/update`, data);
    return response.data;
};

export const getStatisticsSummary = async () => {
    const response = await axios.get(`${API_BASE_URL}/statistics/summary`);
    return response.data;
};

export const getStatisticsPages = async () => {
    const response = await axios.get(`${API_BASE_URL}/statistics/pages`);
    return response.data;
};

export const getStatisticsLogs = async () => {
    const response = await axios.get(`${API_BASE_URL}/statistics/logs`);
    return response.data;
};
