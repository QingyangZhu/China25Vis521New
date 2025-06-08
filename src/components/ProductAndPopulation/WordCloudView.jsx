import React, { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';
import 'echarts-wordcloud';
import './WordCloudView.css';

const WordCloudView = ({ dynasty, onClose, isEmbedded = false }) => {
  const chartRef = useRef(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 古典主题色彩映射 - 基于topic_id
  const getTopicColor = (topicId) => {
    const classicalColors = {
      1: '#8B4513', // 赭石棕 - 朱砂红系
      2: '#2F4F4F', // 深青灰 - 墨色系  
      3: '#4682B4', // 钢青蓝 - 靛蓝系
      4: '#8B7355', // 黄褐色 - 土黄系
      5: '#6B4226', // 深赭色 - 紫檀系
      6: '#556B2F', // 暗橄榄绿 - 松石绿系
      0: '#654321'  // 默认深棕色
    };
    return classicalColors[topicId] || classicalColors[0];
  };

  // 加载词云数据
  useEffect(() => {
    const loadWordCloudData = async () => {
      if (!dynasty) return;
      
      try {
        setLoading(true);
        setError(null);
        
        // 检查是否有该朝代的词云数据
        const availableDynasties = ['元', '明', '清'];
        if (!availableDynasties.includes(dynasty)) {
          throw new Error(`暂无${dynasty}朝代的词云数据。当前仅提供元朝、明朝和清朝的人口主题词云数据。`);
        }
        
        // 构建数据文件路径，根据朝代名称查找对应的词云数据
        const response = await fetch(`/data/problem3/人口主题词云数据/${dynasty}-人口.json`);
        
        if (!response.ok) {
          throw new Error(`无法加载${dynasty}朝代的词云数据文件。`);
        }
        
        const wordCloudData = await response.json();
        setData(wordCloudData);
      } catch (error) {
        console.error('词云数据加载错误：', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    loadWordCloudData();
  }, [dynasty]);

  // 绘制词云
  useEffect(() => {
    if (!data || !chartRef.current) return;

    // 清理旧的图表实例
    echarts.dispose(chartRef.current);
    
    // 创建新的图表实例
    const chart = echarts.init(chartRef.current, null, {
      backgroundColor: 'transparent'
    });

    // 准备词云数据
    const wordCloudData = data.word_data.map(d => {
      const topicColor = getTopicColor(d.topic_id);
      return {
        name: d.word,
        value: d.weight,
        textStyle: {
          color: topicColor,
          fontSize: Math.max(10, Math.min(60, Math.pow(d.normalized_weight, 0.8) * 50 + 10)),
          fontWeight: d.normalized_weight > 0.6 ? 'bold' : 'normal'
        },
        emphasis: {
          textStyle: {
            shadowBlur: 10,
            shadowColor: topicColor
          }
        },
        // 保存原始数据用于提示框
        topicName: d.topic_name,
        originalWeight: d.weight,
        normalizedWeight: d.normalized_weight,
        topicId: d.topic_id
      };
    });

    const option = {
      title: {
        text: data.title || `${dynasty}朝代人口主题词云`,
        left: 'center',
        top: isEmbedded ? 10 : 20,
        textStyle: {
          fontSize: isEmbedded ? 18 : 24,
          fontWeight: 'bold',
          color: '#2d2520',
          fontFamily: "'楷体', 'KaiTi', 'STKaiti', '华文楷体', 'AR PL UKai CN', 'Kaiti SC', 'Noto Serif SC', serif"
        }
      },
      tooltip: {
        show: true,
        backgroundColor: 'rgba(0,0,0,0.8)',
        borderColor: 'rgba(199, 178, 153, 0.5)',
        borderWidth: 1,
        textStyle: {
          color: '#fff',
          fontSize: 12,
          fontFamily: "'楷体', 'KaiTi', 'STKaiti', '华文楷体', 'AR PL UKai CN', 'Kaiti SC', 'Noto Serif SC', serif"
        },
        formatter: function (params) {
          const data = params.data;
          return `
            词汇: ${data.name}<br/>
            主题: ${data.topicName}<br/>
            权重: ${data.originalWeight.toFixed(2)}
          `;
        }
      },
      series: [{
        type: 'wordCloud',
        sizeRange: [10, 60],
        rotationRange: [-45, 45],
        rotationStep: 45,
        gridSize: 6,
        drawOutOfBound: false,
        layoutAnimation: true,
        textStyle: {
          fontFamily: "'楷体', 'KaiTi', 'STKaiti', '华文楷体', 'AR PL UKai CN', 'Kaiti SC', 'Noto Serif SC', serif",
          fontWeight: 'normal'
        },
        emphasis: {
          focus: 'self',
          textStyle: {
            shadowBlur: 10,
            shadowOffsetX: 1,
            shadowOffsetY: 1,
            shadowColor: '#333'
          }
        },
        data: wordCloudData,
        // 词云形状设置
        shape: 'circle',
        left: 'center',
        top: '10%',
        width: '90%', // 在左侧容器中占用90%宽度
        height: '80%'
      }]
    };

    chart.setOption(option);

    // 响应式处理
    const handleResize = () => {
      chart.resize();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.dispose();
    };

  }, [data, isEmbedded, dynasty]);

  if (loading) {
    if (isEmbedded) {
      return (
        <div className="word-cloud-embedded">
          <div className="loading">加载中...</div>
        </div>
      );
    }
    return (
      <div className="word-cloud-overlay">
        <div className="word-cloud-container">
          <div className="loading">加载中...</div>
        </div>
      </div>
    );
  }

  if (error) {
    if (isEmbedded) {
      return (
        <div className="word-cloud-embedded">
          <div className="error">错误: {error}</div>
        </div>
      );
    }
    return (
      <div className="word-cloud-overlay">
        <div className="word-cloud-container">
          <div className="error">错误: {error}</div>
        </div>
      </div>
    );
  }

  if (isEmbedded) {
    return (
      <div className="word-cloud-embedded">
        <div className="word-cloud-content">
          <div className="word-cloud-chart-container">
            <div ref={chartRef} className="word-cloud-chart"></div>
          </div>
          {data && (
            <div className="word-cloud-legend-container">
              <div className="word-cloud-legend">
                <h4 className="legend-title">主题图例</h4>
                <div className="legend-items">
                  {data.topic_info.map(topic => {
                    // 获取该主题下的关键词（取前5个高权重词汇）
                    const topicWords = data.word_data
                      .filter(word => word.topic_id === topic.topic_id)
                      .sort((a, b) => b.normalized_weight - a.normalized_weight)
                      .slice(0, 5)
                      .map(word => word.word);
                    

                    
                    return (
                      <div key={topic.topic_id} className="legend-topic">
                        <div className="legend-header">
                          <span 
                            className="legend-color" 
                            style={{ backgroundColor: getTopicColor(topic.topic_id) }}
                          ></span>
                          <span className="legend-topic-name">
                            主题{topic.topic_id}：{topic.topic_name}
                          </span>
                        </div>
                        <div className="legend-keywords">
                          关键词：{topicWords.join('、')}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="word-cloud-overlay">
      <div className="word-cloud-container">
        <button className="close-button" onClick={onClose}>
          ×
        </button>
        <div className="word-cloud-content">
          <div className="word-cloud-chart-container">
            <div ref={chartRef} className="word-cloud-chart"></div>
          </div>
          {data && (
            <div className="word-cloud-legend-container">
              <div className="word-cloud-legend">
                <h4 className="legend-title">主题图例</h4>
                <div className="legend-items">
                  {data.topic_info.map(topic => {
                    // 获取该主题下的关键词（取前5个高权重词汇）
                    const topicWords = data.word_data
                      .filter(word => word.topic_id === topic.topic_id)
                      .sort((a, b) => b.normalized_weight - a.normalized_weight)
                      .slice(0, 5)
                      .map(word => word.word);
                    

                    
                    return (
                      <div key={topic.topic_id} className="legend-topic">
                        <div className="legend-header">
                          <span 
                            className="legend-color" 
                            style={{ backgroundColor: getTopicColor(topic.topic_id) }}
                          ></span>
                          <span className="legend-topic-name">
                            主题{topic.topic_id}：{topic.topic_name}
                          </span>
                        </div>
                        <div className="legend-keywords">
                          关键词：{topicWords.join('、')}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WordCloudView; 