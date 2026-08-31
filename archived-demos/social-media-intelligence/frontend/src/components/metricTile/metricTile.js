import React, { useState } from 'react';
import './metricTile.scss';
import { Outlet, Link } from "react-router-dom";
import { ArrowRight } from '@carbon/icons-react';

import { Tile, Grid, Column, ColumnHang, GridSettings } from '@carbon/react';

export default function MetricTile(){
    return (
        <Tile id="tile-1" className='metricTile' style={{backgroundColor: "#edf5ff", border: "none", borderRadius: "0px", padding: "30px"}}>
            
      <section className="layout" style={{fontFamily:'IBM Plex Sans'}}>
  <div className="grow1">
    <h1 className='metricValue'>24</h1>
    <Link className='metricLink' to="/regional-issues" style={{color: "black", fontWeight: "400"}}>Regional Competitor Issue Trends <span style={{color: "blue", position: "relative", top: "5%"}}><ArrowRight /></span></Link>
  </div>
  <div className="grow1">
  <h1 className='metricValue'>529</h1>
    <Link className='metricLink' to="/social-media-issues" style={{color: "black", fontWeight: "400"}}>Individual Social Media Issues <span style={{color: "blue", position: "relative", top: "5%"}}><ArrowRight /></span></Link>
  </div>
  <div className="grow1">
  <h1 className='metricValue'>18</h1>
    <Link className='metricLink' to="/issue-trends" style={{color: "black", fontWeight: "400"}}>TelcoA Customer Issues Trends <span style={{color: "blue", position: "relative", top: "5%"}}><ArrowRight /></span></Link>
  </div>
</section>

     



</Tile>
    )
}