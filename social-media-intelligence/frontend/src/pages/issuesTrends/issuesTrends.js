import React, { useState } from "react";
import "./issuesTrends.scss";

import PageHeader from "../../components/pageHeader/pageHeader";
import TrendsDataCards from "../../components/issueTrends/issueTrendsCards";
import Embedchat from "./embedchat";

import { Button } from "@carbon/react";

export default function IssuesTrends() {
  const title = "Customer Issue Trends";
  return (
    <div>
      <div
        style={{
          justifyContent: "center",
          display: "flex",
          right: "40.5%",
          position: "relative",
          top: "-40px",
        }}
      >
        <PageHeader value={title} />
      </div>
      <TrendsDataCards />
      <Embedchat />
    </div>
  );
}
