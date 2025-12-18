import { AxiosError } from 'axios';

export interface ApiError {
  message: string;
  code?: string;
  field?: string;
  statusCode?: number;
}

export interface ParsedError {
  title: string;
  message: string;
  isRetryable: boolean;
  isNetworkError: boolean;
  statusCode?: number;
}

/**
 * User-friendly error messages for common HTTP status codes
 */
const statusCodeMessages: Record<number, { title: string; message: string; isRetryable: boolean }> = {
  400: {
    title: 'Invalid Request',
    message: 'Please check your input and try again.',
    isRetryable: false,
  },
  401: {
    title: 'Session Expired',
    message: 'Please log in again to continue.',
    isRetryable: false,
  },
  403: {
    title: 'Access Denied',
    message: 'You do not have permission to perform this action.',
    isRetryable: false,
  },
  404: {
    title: 'Not Found',
    message: 'The requested resource could not be found.',
    isRetryable: false,
  },
  409: {
    title: 'Conflict',
    message: 'This action conflicts with existing data.',
    isRetryable: false,
  },
  422: {
    title: 'Validation Error',
    message: 'Please check your input and try again.',
    isRetryable: false,
  },
  429: {
    title: 'Too Many Requests',
    message: 'Please wait a moment before trying again.',
    isRetryable: true,
  },
  500: {
    title: 'Server Error',
    message: 'Something went wrong on our end. Please try again later.',
    isRetryable: true,
  },
  502: {
    title: 'Service Unavailable',
    message: 'Our service is temporarily unavailable. Please try again later.',
    isRetryable: true,
  },
  503: {
    title: 'Service Unavailable',
    message: 'Our service is temporarily unavailable. Please try again later.',
    isRetryable: true,
  },
  504: {
    title: 'Request Timeout',
    message: 'The request took too long. Please try again.',
    isRetryable: true,
  },
};

/**
 * Parse an error and return user-friendly error information
 */
export const parseError = (error: unknown): ParsedError => {
  // Handle Axios errors
  if (isAxiosError(error)) {
    // Network error (no response)
    if (!error.response) {
      return {
        title: 'Connection Error',
        message: 'Unable to connect to the server. Please check your internet connection.',
        isRetryable: true,
        isNetworkError: true,
      };
    }

    const statusCode = error.response.status;
    const responseData = error.response.data as { message?: string; error?: string } | undefined;

    // Get status-specific message or use default
    const statusMessage = statusCodeMessages[statusCode] || {
      title: 'Error',
      message: 'An unexpected error occurred.',
      isRetryable: true,
    };

    // Use server message if available and meaningful
    const serverMessage = responseData?.message || responseData?.error;
    const message = serverMessage && serverMessage.length < 200 
      ? serverMessage 
      : statusMessage.message;

    return {
      title: statusMessage.title,
      message,
      isRetryable: statusMessage.isRetryable,
      isNetworkError: false,
      statusCode,
    };
  }

  // Handle standard Error objects
  if (error instanceof Error) {
    // Check for network-related errors
    if (error.message.includes('Network') || error.message.includes('network')) {
      return {
        title: 'Connection Error',
        message: 'Unable to connect to the server. Please check your internet connection.',
        isRetryable: true,
        isNetworkError: true,
      };
    }

    return {
      title: 'Error',
      message: error.message || 'An unexpected error occurred.',
      isRetryable: true,
      isNetworkError: false,
    };
  }

  // Handle string errors
  if (typeof error === 'string') {
    return {
      title: 'Error',
      message: error,
      isRetryable: true,
      isNetworkError: false,
    };
  }

  // Default fallback
  return {
    title: 'Error',
    message: 'An unexpected error occurred. Please try again.',
    isRetryable: true,
    isNetworkError: false,
  };
};

/**
 * Type guard for Axios errors
 */
export const isAxiosError = (error: unknown): error is AxiosError => {
  return (error as AxiosError)?.isAxiosError === true;
};

/**
 * Extract field-specific validation errors from API response
 */
export const extractValidationErrors = (
  error: unknown
): Record<string, string> => {
  if (!isAxiosError(error) || !error.response) {
    return {};
  }

  const responseData = error.response.data as {
    errors?: Array<{ field: string; message: string }>;
    fieldErrors?: Record<string, string>;
  } | undefined;

  if (!responseData) {
    return {};
  }

  // Handle array of field errors
  if (Array.isArray(responseData.errors)) {
    return responseData.errors.reduce((acc, err) => {
      if (err.field && err.message) {
        acc[err.field] = err.message;
      }
      return acc;
    }, {} as Record<string, string>);
  }

  // Handle object of field errors
  if (responseData.fieldErrors) {
    return responseData.fieldErrors;
  }

  return {};
};

/**
 * Get a simple error message string from any error
 */
export const getErrorMessage = (error: unknown): string => {
  const parsed = parseError(error);
  return parsed.message;
};
