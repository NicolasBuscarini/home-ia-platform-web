import { I18nProvider } from 'home-ia-shared';
import React from 'react';
import ReactDOM from 'react-dom/client';
import 'home-ia-shared/styles.css';
import AccessModule from './AccessModule';

const root = document.getElementById('root');
if (!root) throw new Error('Elemento raiz do módulo não encontrado.');

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <I18nProvider initialLocale="pt-BR">
      <AccessModule userRole="Administrator" />
    </I18nProvider>
  </React.StrictMode>,
);
