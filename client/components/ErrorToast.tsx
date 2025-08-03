import React, { useEffect } from 'react';
import { useError } from '../contexts/ErrorContext';
import { toast } from 'react-hot-toast';

export default function ErrorToastContainer() {
  const { errors, removeError } = useError();

  useEffect(() => {
    errors.forEach((error) => {
      // Create toast and handle removal after duration
      toast.error(error.message, {
        id: error.id,
        duration: 5000,
      });
      
      // Set timeout to remove error after toast duration
      setTimeout(() => {
        removeError(error.id);
      }, 5000);
    });
  }, [errors, removeError]);

  return null;
}