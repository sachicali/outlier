import React, { createContext, useContext, useReducer, ReactNode } from 'react';

interface ErrorState {
  errors: Array<{
    id: string;
    message: string;
    type: 'error' | 'warning' | 'info';
    timestamp: Date;
  }>;
}

interface ErrorContextType extends ErrorState {
  addError: (message: string, type?: 'error' | 'warning' | 'info') => void;
  removeError: (id: string) => void;
  clearErrors: () => void;
}

type ErrorAction =
  | { type: 'ADD_ERROR'; payload: { id: string; message: string; type: 'error' | 'warning' | 'info' } }
  | { type: 'REMOVE_ERROR'; payload: string }
  | { type: 'CLEAR_ERRORS' };

const initialState: ErrorState = {
  errors: [],
};

function errorReducer(state: ErrorState, action: ErrorAction): ErrorState {
  switch (action.type) {
    case 'ADD_ERROR':
      return {
        ...state,
        errors: [
          ...state.errors,
          {
            ...action.payload,
            timestamp: new Date(),
          },
        ],
      };
    case 'REMOVE_ERROR':
      return {
        ...state,
        errors: state.errors.filter(error => error.id !== action.payload),
      };
    case 'CLEAR_ERRORS':
      return {
        ...state,
        errors: [],
      };
    default:
      return state;
  }
}

const ErrorContext = createContext<ErrorContextType | undefined>(undefined);

export function ErrorProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(errorReducer, initialState);

  const addError = (message: string, type: 'error' | 'warning' | 'info' = 'error') => {
    const id = Math.random().toString(36).substr(2, 9);
    dispatch({ type: 'ADD_ERROR', payload: { id, message, type } });
  };

  const removeError = (id: string) => {
    dispatch({ type: 'REMOVE_ERROR', payload: id });
  };

  const clearErrors = () => {
    dispatch({ type: 'CLEAR_ERRORS' });
  };

  return (
    <ErrorContext.Provider value={{
      ...state,
      addError,
      removeError,
      clearErrors,
    }}>
      {children}
    </ErrorContext.Provider>
  );
}

export function useError() {
  const context = useContext(ErrorContext);
  if (context === undefined) {
    throw new Error('useError must be used within an ErrorProvider');
  }
  return context;
}