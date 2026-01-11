import React from 'react';
import { ProcessingProgress } from '../types';

interface ProcessingPanelProps {
  progress: ProcessingProgress | null;
  onCancel: () => void;
}

export const ProcessingPanel: React.FC<ProcessingPanelProps> = ({ progress, onCancel }) => {
  if (!progress) return null;

  return (
    <div
      style={{
        padding: '1.25rem',
        background: 'white',
        borderRadius: '12px',
        margin: '1rem 0',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
      }}
    >
      <div style={{ marginBottom: '1rem', fontWeight: '600', fontSize: '1rem', color: '#333' }}>
        ⚙️ {progress.stage}...
      </div>
      <div
        style={{
          width: '100%',
          height: '28px',
          background: '#e9ecef',
          borderRadius: '14px',
          overflow: 'hidden',
          marginBottom: '0.75rem',
          boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.1)'
        }}
      >
        <div
          style={{
            width: `${progress.progress * 100}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
            transition: 'width 0.3s ease',
            borderRadius: '14px'
          }}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ fontSize: '0.95rem', color: '#666', fontWeight: '500' }}>
          {Math.round(progress.progress * 100)}% complete
        </div>
        <button
          onClick={onCancel}
          style={{
            padding: '0.5rem 1rem',
            background: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '0.9rem',
            fontWeight: '500',
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(220, 53, 69, 0.3)'
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};
