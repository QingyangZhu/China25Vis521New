import React, { useEffect, useState } from 'react';
import './DynastyInfo.css';

const InfoRow = ({ label, value, bold = false }) => (
  <div className="row" style={{ fontFamily: '楷体', fontSize: bold ? 10 : 9, fontWeight: bold ? 'bold' : 'normal' }}>
    <label>{label}<span>{value}</span></label>
  </div>
);

const DynastyInfo = ({ dynastyName = '秦' }) => {
  const [dynastyInfo, setDynastyInfo] = useState({
    zhidu: '未知',
    xingzheng: '未知',
    junshi: '未知',
    ducheng: '否'
  });

  useEffect(() => {
    // 更新图片源
    const dynastyImg = document.querySelector('.dynasty-image');
    if (dynastyImg) {
      dynastyImg.src = `${process.env.PUBLIC_URL}/image/${dynastyName}.png`;
    }

    // 获取CSV数据
    fetch(`${process.env.PUBLIC_URL}/data/建制沿革/jianzhi_change.csv`)
      .then(response => response.text())
      .then(data => {
        const rows = data.split('\n');
        const headers = rows[0].split(',');

        // 查找选中朝代的行
        const dynastyRow = rows.find(row => row.includes(dynastyName));
        if (dynastyRow) {
          const values = dynastyRow.split(',');
          setDynastyInfo({
            zhidu: values[5] || '未知',
            xingzheng: values[3] || '未知',
            junshi: values[4] || '未知',
            ducheng: values[6] || '否'
          });
        }
      })
      .catch(error => {
        console.error('Error loading dynasty data:', error);
      });
  }, [dynastyName]);

  return (
    <div className="dynasty-info" style={{ height: '120px' }}>
      <div className="row" style={{ margin: 2, height: '55%' }}>
        <img 
          className="dynasty-image"
          src={`${process.env.PUBLIC_URL}/image/${dynastyName}.png`}
          alt={dynastyName}
          style={{ 
            height: '100%', 
            width: '100%', 
            margin: 0, 
            padding: 0,
            objectFit: 'cover'
          }}
        />
      </div>
      
      <InfoRow label="建制制度：" value={dynastyInfo.zhidu} bold />
      <InfoRow label="行政机构：" value={dynastyInfo.xingzheng} />
      <InfoRow label="军事机构：" value={dynastyInfo.junshi} />
      <InfoRow label="是否为都城：" value={dynastyInfo.ducheng} />
    </div>
  );
};

export default DynastyInfo; 