"use client";

import React from "react";

export const Header: React.FC = () => {
  return (
    <div className="header-container">
      <div className="header-logo">
        <div className="logo-placeholder"></div>
      </div>
      <div className="kamen-logo">
        <div className="kamen-placeholder"></div>
      </div>
      <div className="header-chip">
        <span>versão beta</span>
      </div>
    </div>
  );
};

