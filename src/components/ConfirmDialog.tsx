'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
      <div className="glass-panel antigravity-shadow rounded-2xl w-full max-w-sm overflow-hidden animate-fade-in-up">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-red-500/10 text-red-500 rounded-full flex-shrink-0">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">
                {message}
              </p>
            </div>
          </div>
        </div>
        <div className="p-4 border-t border-gray-100 dark:border-gray-700/50 flex gap-3 justify-end bg-gray-50/50 dark:bg-gray-800/50">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onCancel();
            }}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors antigravity-shadow active:scale-95"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
