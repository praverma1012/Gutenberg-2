import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Storefront from './pages/Storefront.jsx';
import Reader from './pages/Reader.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Storefront />} />
      <Route path="/read/:bookId" element={<Reader />} />
    </Routes>
  );
}
