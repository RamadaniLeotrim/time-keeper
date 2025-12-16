import React from 'react';
import { createPortal } from 'react-dom';
import { Loader2 } from 'lucide-react';

interface LoadingOverlayProps {
    isLoading: boolean;
    message?: string;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ isLoading, message }) => {
    if (!isLoading) return null;

    return createPortal(
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-900/50 backdrop-blur-sm animate-fade-in">
            <Loader2 size={48} className="animate-spin text-sky-500 mb-4" />
            {message && <p className="text-white font-medium animate-pulse">{message}</p>}
        </div>,
        document.body
    );
};

export default LoadingOverlay;
