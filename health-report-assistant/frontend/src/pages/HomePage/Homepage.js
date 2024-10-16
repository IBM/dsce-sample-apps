import React, { useState, useEffect } from "react";
import "./index.scss";
import { useSelector, useDispatch } from "react-redux";
// var os = require('os');

import {
  Row,
  Button,
  Breadcrumb,
  BreadcrumbItem,
  Grid,
  Column,
  Tile,
  SkeletonPlaceholder,
  FileUploader,
  Loading,
} from "@carbon/react";
import {
  addAnotherObject,
  selectAnotherObjectArr,
} from "../../store/anotherObjectReducer";
import PdfViewer from "./PdfViewer";
import axios from "axios";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";


function Homepage() {
  console.log('sds', process.env.REACT_APP_WA_INT_ID)
  const wa_inst_id = process.env.REACT_APP_WA_INT_ID;
  const svc_inst_id = process.env.REACT_APP_SVC_INST_ID;
  const backendUrl = process.env.REACT_APP_BACKEND_URL;

  const [backendData, setBackendData] = useState("");
  const [loading, setLoading] = useState(false); // Changed isLoading to setLoading
  const [showSkeleton, setShowSkeleton] = useState(false); 
  // const [skeleton, setSkeleton] = useState(false); // Changed showSkeleton to setSkeleton

  const [selectedPersona, setSelectedPersona] = useState(""); // State to store selected persona
  const [userQuery, setUserQuery] = useState(""); // State to store user's query
  const [selectedFile, setSelectedFile] = useState(null);
  const [pdfContent, setPdfContent] = useState(null);
  const [summary, setSummary] = useState(null);
  const [clearSummary, setClearSummary] = useState(true);
  const [notSupported, setNotSupported] = useState(false)

  const handlePdfContentReady = (content) => {
    setPdfContent(content);
  };

  //Enable user interaction with anotherObject
  const dispatch = useDispatch();

  const handleFileChange = (event) => {
    setClearSummary(true);
    const file = event.target.files[0];
    setSelectedFile(file);
  };

//https://healthcareapiv1.16g3cpk22hsi.us-south.codeengine.appdomain.cloud/api/upload

  const handleSendContentToBackend = async () => {
    setLoading(true);
    console.log(JSON.stringify({ pdfContent }))
    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append('textData', pdfContent)
    setNotSupported(false)
    try {
      const response = await fetch(`${backendUrl}/api/upload`, {
        method: "POST",
        body: formData
      });

      // if (response.data && response.data.summary) {
      //   console.log("PDF content sent to backend successfully", response.data);
      //   setSummary(response.data.summary);
      if (response.ok) {
        const data = await response.json();
        console.log("PDF content sent to backend successfully", data);
        data.notSupported ? setNotSupported(true) : setSummary(data.summary);
        setClearSummary(false);
        setLoading(false);
      } else {
        console.error("Error sending PDF content to backend");
        setLoading(false);
      }
    } catch (error) {
      console.error("Error sending PDF content to backend", error);
      setLoading(false);
    }
  };

  const onClickButton = () => {
    if (!selectedPersona || !userQuery) {
      alert("Please select a persona and enter a query.");
      return;
    }

    // Show the skeleton loader
    //setSkeleton(true);

    dispatch(addAnotherObject({ anotherObject: "Another object!" }));

    const encodedQuery = encodeURIComponent(userQuery);
    // Fetch data from the backend with selected persona and user query

    axios
      .get("/api/data", {
        params: {
          persona: selectedPersona,
          query: encodedQuery,
        },
      })
      .then((response) => {
        setBackendData(response.data.message);
        // Hide the skeleton loader
        //setSkeleton(false);
      })
      .catch((error) => {
        console.error("Error fetching data:", error);
        setLoading(false); // Hide the skeleton loader in case of error
        //setSkeleton(false);
      });
  };

  // Retrieve anotherObject from Store
  const anotherObjectArr = useSelector((state) =>
    selectAnotherObjectArr(state)
  );

  const items = [
    {
      id: "Student",
      label: "Student",
    },
    {
      id: "Doctor",
      label: "Doctor",
    },
    {
      id: "Medical Practitioner",
      label: "Medical Practitioner",
    },
    {
      id: "Other",
      label: "Other",
    },
  ];

  useEffect(() => {
    window.watsonAssistantChatOptions = {
      integrationID: wa_inst_id, // The ID of this integration.
      region: "us-south", // The region your integration is hosted in.
      serviceInstanceID: svc_inst_id, // The ID of your service instance.
      onLoad: function (instance) { instance.render(); },
      showCloseAndRestartButton: true
    };
    setTimeout(function () {
      const t = document.createElement('script');
      t.src = "https://web-chat.global.assistant.watson.appdomain.cloud/versions/" + (window.watsonAssistantChatOptions.clientVersion || 'latest') + "/WatsonAssistantChatEntry.js";
      t.async = true;
      document.head.appendChild(t);
      return () => {
        document.head.removeChild(t);
      }
    });
  }, [])

  return (
    <Grid>
      <Column lg={8} md={4} sm={2} className="landing-page__banner">

        <h1 className="landing-page__heading">
        Health Record Assistant
        </h1>

        <div style={{ width: "150px", height: "50px", marginTop: "10px" }}></div>

        <p>Download sample report of <a href="/default-files/breast-biopsy-bc.pdf" target="_blank">breast biopsy</a>, <a href="/default-files/kidney-stone-ds-report.pdf" target="_blank">kidney stone</a>, <a href="/default-files/prostate-report.pdf" target="_blank">prostate</a>.</p>
        <br/>
        <div className="cds--file__container">
          <FileUploader
            accept={[".pdf"]}
            buttonKind="primary"
            size="lg"
            buttonLabel="Add files"
            filenameStatus="edit"
            iconDescription="Clear file"
            labelDescription="only .pdf files at 500mb or less"
            labelTitle="Please upload your medical records to get started"
            onChange={handleFileChange}
          />
          {selectedFile && (
            <PdfViewer
              pdfFile={selectedFile}
              onPdfContentReady={handlePdfContentReady}
            />
          )}
        </div>

        <Button
          style={{ marginTop: "15px", marginBottom: "15px" }}
          onClick={() => {
            setClearSummary(false)
            setShowSkeleton(true)
            handleSendContentToBackend();
          }}
        >
          Summarize
        </Button>
        
        {clearSummary ? (
          <></>
        ) : (
          <>
            {loading ? (
              showSkeleton ? ( // Only show the skeleton when showSkeleton is true
                <SkeletonPlaceholder  style={{ width: "40%" }}/>
              ) : null // Hide the skeleton when showSkeleton is false
            ) : (
              <Tile className="output-tile">
                {notSupported ? 
                    (<p>Please upload only given sample reports</p>) : 
                    (<><h3>Generated Summary:</h3><p>{summary}</p></>)}
              </Tile>
            )}
          </>
        )}

            </Column>

            <Column md={4} lg={8} sm={2}>
              <div className="image-container">
                <img
                  className="landing-page__illo"
                  src="persona.png"
                  alt="Different Personas"
                />
              </div>
            </Column>
          </Grid>

        );
}

        export default Homepage;