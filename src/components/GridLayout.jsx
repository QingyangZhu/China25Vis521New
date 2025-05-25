import React from 'react';
import './GridLayout.css';

const GridLayout = ({ 
  header, 
  leftTop, 
  leftBottom,
  centerTop,
  centerBottom,
  rightTop,
  rightBottom,
  timeline 
}) => {
  return (
    <div className="grid-container">
      <div className="header">{header}</div>
      <div className="left-top">{leftTop}</div>
      <div className="left-bottom">{leftBottom}</div>
      <div className="center-top">{centerTop}</div>
      <div className="center-bottom">{centerBottom}</div>
      <div className="right-top">{rightTop}</div>
      <div className="right-bottom">{rightBottom}</div>
      <div className="timeline">{timeline}</div>
    </div>
  );
};

export default GridLayout; 