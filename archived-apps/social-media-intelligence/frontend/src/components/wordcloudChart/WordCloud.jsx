import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import cloud from 'd3-cloud';

const WordCloud = ({ words,selectedComponent }) => {
  const wordCloudRef = useRef();
  // Predefined set of colors
  const colors = ['orange', 'blue', 'black', 'red', 'green', 'purple', 'deeppink', 'brown', 'blueviolet', 'crimson', 'darkblue', 'indigo', 'maroon'];

  // Function to get a random color from the predefined set
  const getRandomColor = () => {
    return colors[Math.floor(Math.random() * colors.length)];
  };

  useEffect(() => {
    d3.select(wordCloudRef.current).selectAll("*").remove();
    const drawWordCloud = () => {
      const layout = cloud()
        .size([600, 300])
        .words(words.map((d) => ({ text: d.text, size: d.value })))
        .padding(5)
        .rotate(() => ~~(Math.random() * 2) * 90)
        .fontSize((d) => d.size)
        .on('end', (words) => {
          d3.select(wordCloudRef.current)
            .append('svg')
            .attr('width', layout.size()[0])
            .attr('height', layout.size()[1])
            .append('g')
            .attr('transform', 'translate(' + layout.size()[0] / 2 + ',' + layout.size()[1] / 2 + ')')
            .selectAll('text')
            .data(words)
            .enter().append('text')
            .style('font-size', (d) => d.size)
            .style('fill', getRandomColor) // Apply random color from the set
            .attr('text-anchor', 'middle')
            .attr('transform', (d) => 'translate(' + [d.x, d.y] + ')rotate(' + d.rotate + ')')
            .text((d) => d.text);
        });

      layout.start();
    };

    drawWordCloud();
  }, [words,selectedComponent]);

  return <div style={{padding: "40px 0"}} ref={wordCloudRef}></div>;
};

export default WordCloud;