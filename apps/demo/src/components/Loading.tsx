"use client";

import React from "react";

export const Loading: React.FC = () => {
  return (
    <div className="loading-screen">
      <div className="loading-spinner">
        <div className="spinner-ring"></div>
        <div className="spinner-ring"></div>
        <div className="spinner-ring"></div>
      </div>
      <p className="loading-text">Carregando avatar...</p>
    </div>
  );
};

