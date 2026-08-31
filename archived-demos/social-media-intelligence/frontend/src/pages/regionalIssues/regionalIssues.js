import React, { useState } from "react";
import "./regionalIssues.scss";

import { Button } from "@carbon/react";
import PageHeader from "../../components/pageHeader/pageHeader";
import DataCards from "../../components/regionalssueCard/regionalissueCard";

export default function RegionalIssues() {
  const title = "Regional Competitor Issue Trends";
  return (
    <div>
      <div
        style={{
          justifyContent: "center",
          display: "flex",
          right: "35%",
          position: "relative",
          top: "-40px",
        }}
      >
        <PageHeader value={title} />
      </div>
      <DataCards />
    </div>
  );
}
