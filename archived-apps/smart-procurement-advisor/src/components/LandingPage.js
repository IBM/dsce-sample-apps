import React, { useState, useEffect } from 'react';
import { IoIosNotifications } from 'react-icons/io';
import { CiCamera } from "react-icons/ci";
import { IoCartSharp } from "react-icons/io5";
import { IoIosSearch } from "react-icons/io";
import { IoDocumentTextSharp } from "react-icons/io5";
import Card from 'react-bootstrap/Card';
import { useLocation } from 'react-router-dom';
import './style.css';
import { watsonxIntegrationID, watsonxRegion, watsonxServiceInstanceID } from './watsonxVariables';
import { Routes, Route, useNavigate } from 'react-router-dom';



function Home() {
    return (
        <div style={{ textAlign: 'center' }} />
    );
}
function Footer() {
    return (
        /* <footer style={{
            backgroundImage: 'url(/images/watsonXbg.png)',
            backgroundSize: 'cover',
            padding: '5px',
            color: 'black',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            fontFamily: 'IBM Plex Sans, sans-serif',
            marginTop: 'auto',
            position: 'fixed',
            bottom: 0,
            width: '100%',
            fontWeight: 'bold'
        }}> */
        // This footer content for DSCE
        <footer style={{
            padding: '5px',
            backgroundColor: '#212529',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            fontFamily: 'IBM Plex Sans, sans-serif',
            marginTop: 'auto',
            position: 'sticky',
            bottom: 0,
            width: '100%',
            color: 'white',
            fontSize: '12px',
            zIndex: '1000 !important', // Set a higher value than the chatbot icon's z-index
        }}>
            {/* Powered by&nbsp; <a href="https://www.ibm.com/watsonx" target="_blank" rel="noopener noreferrer" style={{ color: 'white', textDecoration: 'underline', cursor: 'pointer' }}>watsonx</a> */}
            Do not input personal data, or data that is sensitive or confidential into demo app. This app is built using the watsonx.ai SDK and may include systems and methods pending patent with the USPTO, protected under US Patent Laws. © Copyright IBM Corporation
        </footer>
    );
}



function Dialog({ onClose }) {
    return (
        <>
            <div
                style={{
                    position: 'fixed',
                    top: '0',
                    left: '0',
                    width: '100%',
                    height: '100%',
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    zIndex: '999',
                    backdropFilter: 'blur(2px)',
                }}
                onClick={onClose}
            />
            <div
                style={{
                    position: 'fixed',
                    top: '30%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    padding: '20px',
                    backgroundImage: 'url(/images/watsonXbg.png)',
                    borderRadius: '5px',
                    boxShadow: '0px 0px 10px rgba(0, 0, 0, 0.1)',
                    zIndex: '1000',
                    fontFamily: 'IBM Plex Sans, sans-serif'
                }}
            >
                <p>No Catalog Item Found - Please initiate a Purchase Requisition via watsonx chatbot</p>
                <button style={{
                    color: 'white', backgroundColor: '#0e62fe', borderRadius: '5px',
                    boxShadow: '0px 0px 10px rgba(0, 0, 0, 0.1)',
                    zIndex: '1000'
                }} onClick={onClose}>Go to watsonx Assistant</button>
            </div>
        </>
    );
}


/* function AuthorSignature() {
    return (
        <div style={{ marginTop: '20px', bottom: '0', color: '#888', fontStyle: 'italic' }}>
            <p>Developed by: Ankit Guria</p>
            <p>Contact: Blue Partner Labs, IBM India Software Labs, email: ankit.guria@ibm.com</p>
        </div>
    );
} */

function LandingPage() {
    const [searchInput, setSearchInput] = useState('');
    const [showDialog, setShowDialog] = useState(false);
    //const [chatInstance, setChatInstance] = useState(null);
    const navigate = useNavigate();
    const location = useLocation();
    if (window.count === undefined) {
        window.count = 0;
    };

    /* const preSendHandler = (event) => {
        var given_name = "Tom";

        event.data.context.skills['actions skill'] = event.data.context.skills['actions skill'] || {};
        event.data.context.skills['actions skill'].skill_variables = event.data.context.skills['actions skill'].skill_variables || {};
        event.data.context.skills['actions skill'].skill_variables.User = given_name;
    }; */

    useEffect(() => {

        /* const integrationID = process.env.REACT_APP_INTEGRATION_ID;
        const region = process.env.REACT_APP_REGION;
        const serviceInstanceID = process.env.REACT_APP_SERVICE_INSTANCE_ID;
        const cleanedIntegrationID = integrationID.replace(/\\/g, '');
        const cleanedRegion = region.replace(/\\/g, '');
        const cleanedServiceInstanceID = serviceInstanceID.replace(/\\/g, ''); */
        //const customElement = document.querySelector('.WebChatContainer');
        const customElement = document.querySelector('.WebChatContainer');
        let chatInstance = window.watsonAssistantChatInstance;


        if (chatInstance) {
            chatInstance.destroy();
        }
        window.watsonAssistantChatOptions = {
            integrationID: watsonxIntegrationID,
            region: watsonxRegion,
            serviceInstanceID: watsonxServiceInstanceID,
            showRestartButton: true,
            element: customElement,

            onLoad: function (instance) {


                //if (location.pathname === "/" && location.pathname !== "/ChargerCatlog" && location.pathname !== "/OrderDetail") {
                if (window.count === 0 && location.pathname === "/" && location.pathname !== "/ChargerCatlog" && location.pathname !== "/OrderDetail") {
                    instance.render().then(function () {
                    }).catch(function (e) {
                        console.error(e);
                    });

                    instance.on({ type: 'view:change', handler: viewChangeHandler });
                    instance.elements.getMainWindow().addClassName('HideWebChat');

                    window.count++;
                    window.watsonAssistantChatInstance = instance;
                }
                else {
                    window.count--;
                }

            }
        };

        setTimeout(function () {
            const t = document.createElement('script');
            t.src = "https://web-chat.global.assistant.watson.appdomain.cloud/versions/" + (window.watsonAssistantChatOptions.clientVersion || 'latest') + "/WatsonAssistantChatEntry.js";
            document.head.appendChild(t);
        });

    }, [location.pathname]);


    const viewChangeHandler = (event, instance) => {

        if (event.newViewState.mainWindow) {
            instance.elements.getMainWindow().removeClassName('HideWebChat');
        } else {
            instance.elements.getMainWindow().addClassName('HideWebChat');
        }

    }


    const handleSearch = () => {
        if (searchInput.includes("Charger") || searchInput.includes("charger") || searchInput.includes("CHARGER") || searchInput.includes("Cable") || searchInput.includes("cable") || searchInput.includes("CABLE")) {
            navigate('/ChargerCatalog');
        }
        else if (searchInput.includes("Pump") || searchInput.includes("pump") || searchInput.includes("PUMP")) {
            setShowDialog(true);
        } else {
            setShowDialog(false);
        }
    };

    const onEnter = (event) => {
        if (event.code === "Enter") {
            handleSearch();
        }
    }

    const onOrderDetail = () => {
        navigate('/OrderDetail');
    }
    const onWatsonOrderDetail = () => {
        navigate('/WatsonOrders');
    }
    /*  const handleRedirectToIBM = () => {
         window.open('https://www.ibm.com', '_blank');
     } */
    const onHowtoUse = () => {
        //navigate('/HelpPage', '_blank');
        window.open('/HelpPage', '_blank');
        //window.open('https://ibm.ent.box.com/file/1344844376428?s=wtg71fv1ize3nkxt109koa3lme1rst0h', '_blank');
    }
    return (

        <div style={{ textAlign: 'center' }}>
            {/* <header style={{
                backgroundImage: 'url(/images/watsonXbg.png)', 
                backgroundSize: 'cover', 
                padding: '10px 20px',
                color: 'white',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontFamily: 'IBM Plex Sans, sans-serif'
            }}> */}
            {/* <header style={{ height: '3rem',
    border: '1px solid rgb(57, 57, 57)',
    color: 'rgb(255, 255, 255)', 
    fontFamily: 'IBM Plex Sans, sans-serif'}}> */}



            {/* This header content for DSCE */}
            <header style={{ backgroundColor: '#212529', height: '3rem', top: '0%', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                {/* <div >
                    <SiIbm style={{ fontSize: '14px', marginLeft: '20px', cursor: 'pointer', color: 'black' }} onClick={handleRedirectToIBM} />
                </div> */}
                {/* <div>
                    <p style={{ margin: 0, fontSize: '14px', color: 'white', fontWeight:'bold', fontFamily: 'IBM Plex Sans, sans-serif' }}> IBM Smart Procurement Advisor</p>
                </div> */}
                <div style={{ marginLeft: '1%', fontSize: '14px', color: 'white', fontWeight: 'bold', fontFamily: 'IBM Plex Sans, sans-serif' }}>
                    <p style={{ margin: 0 }}>  Smart Procurement Advisor</p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div >
                        <IoIosNotifications style={{ fontSize: '16px', marginRight: '40px', color: 'white' }} />
                    </div>
                    <div >
                        <CiCamera style={{ fontSize: '16px', marginRight: '40px', color: 'white' }} />
                    </div>
                    <div>
                        <IoCartSharp style={{ fontSize: '16px', marginRight: '40px', color: 'white' }} />
                    </div>
                    {/* <div>
                        <p onClick={() => onHowtoUse()} style={{ fontSize: '16px', fontFamily: 'IBM Plex Sans, sans-serif', cursor: 'pointer', marginRight: '40px', color: 'white' }}>Help ?</p>
                    </div>  */}
                </div>
            </header>
            <div style={{ marginTop: '2%' }}>

                <div style={{ padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {/* <div style={{ marginRight: 'auto' }}>
                        <IoDocumentTextSharp  onClick={() => onHowtoUse()} style={{ fontSize: '16px', fontFamily: 'IBM Plex Sans, sans-serif', cursor: 'pointer', color: 'white', border: 'none', backgroundColor: '#0e62fe' }}>Guide </IoDocumentTextSharp>
                    </div> */}

                    <div style={{ marginRight: 'auto' }}>
                        <button onClick={() => onHowtoUse()} style={{ fontSize: '16px',width:'auto', fontFamily: 'IBM Plex Sans, sans-serif', cursor: 'pointer', color: 'white', border: 'none', backgroundColor: '#0e62fe', display: 'flex', alignItems: 'center' }}>
                        Demo Guide
            <IoDocumentTextSharp style={{ marginLeft: '30px' }} /> {/* Added margin-right */}
            
        </button>
                    </div>


                    <div style={{ position: 'relative', display: 'flex', boxShadow: '0.5px 0.5px 10px #808080', borderRadius: '5px' }}>
                        <input
                            type="text"
                            placeholder="Search for Pump/ Charger/ Refrigerators..."
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)} onKeyUp={onEnter}
                            style={{ width: '500px', padding: '10px', marginRight: '10px', border: '3px solid #ddd', borderRadius: '5px', fontFamily: 'IBM Plex Sans, sans-serif' }}
                        />
                        <button
                            onClick={handleSearch}
                            style={{ position: 'absolute', right: 0, top: 0, bottom: 0, padding: '10px', cursor: 'pointer', border: 'none', backgroundColor: '#0e62fe', color: 'white', borderRadius: '0 5px 5px 0' }}
                        >
                            <IoIosSearch style={{ fontSize: '20px' }} />
                        </button>
                    </div>

                    <div style={{ marginLeft: 'auto' }}></div>
                </div>







                {/* watsonx assistant positioning: */}

                <div className="WebChatContainer"></div>

                <div style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <div style={{ marginRight: '100px' }}>
                            <Card onClick={() => onOrderDetail()} style={{
                                width: '10rem',
                                cursor: 'pointer',
                                border: '1px solid #ddd',
                                borderRadius: '10px',
                                transition: 'box-shadow 0.3s ease-in-out'
                            }}
                                onMouseOver={(e) => {
                                    e.currentTarget.style.boxShadow = '10px 10px 20px #808080';
                                }}
                                onMouseOut={(e) => {
                                    e.currentTarget.style.boxShadow = 'none';
                                }}
                            >
                                <Card.Img variant="top" src="images/archive (1).svg" style={{ height: '5rem', marginTop: '10px' }} />
                                <Card.Body>
                                    <Card.Title style={{ textAlign: 'center', fontFamily: 'IBM Plex Sans, sans-serif' }}><h3>Orders (5)</h3>
                                        <Card.Subtitle style={{ textAlign: 'center', marginBottom: '15px' }} >All Order Details</Card.Subtitle>
                                    </Card.Title>
                                </Card.Body>
                            </Card>

                        </div>
                        <div style={{ marginRight: '100px' }}>
                            <Card onClick={() => onWatsonOrderDetail()} style={{
                                width: '10rem',
                                cursor: 'pointer',
                                border: '1px solid #ddd',
                                borderRadius: '10px',
                                transition: 'box-shadow 0.3s ease-in-out'
                            }}
                                onMouseOver={(e) => {
                                    e.currentTarget.style.boxShadow = '10px 10px 20px #808080';
                                }}
                                onMouseOut={(e) => {
                                    e.currentTarget.style.boxShadow = 'none';
                                }}
                            >
                                <Card.Img variant="top" src="images/ibm-watson--orders.svg" style={{ height: '5rem', marginTop: '5px' }} />
                                <Card.Body>
                                    <Card.Title style={{ textAlign: 'center', fontFamily: 'IBM Plex Sans, sans-serif' }}><h3>watsonx (2)</h3>
                                        <Card.Subtitle style={{ textAlign: 'center', marginBottom: '15px' }} >Ordered via webchat</Card.Subtitle>
                                    </Card.Title>
                                </Card.Body>
                            </Card>

                        </div>
                        <div style={{ marginRight: '100px' }}>
                            <Card style={{
                                width: '10rem',
                                cursor: 'pointer',
                                border: '1px solid #ddd',
                                borderRadius: '10px',
                                transition: 'box-shadow 0.3s ease-in-out'
                            }}
                                onMouseOver={(e) => {
                                    e.currentTarget.style.boxShadow = '10px 10px 20px #808080';
                                }}
                                onMouseOut={(e) => {
                                    e.currentTarget.style.boxShadow = 'none';
                                }}
                            >
                                <Card.Img variant="top" src="images/cancelled.svg" style={{ height: '5rem', marginTop: '10px' }} />
                                <Card.Body>
                                    <Card.Title style={{ textAlign: 'center', fontFamily: 'IBM Plex Sans, sans-serif' }}><h3>Cancelled (0)</h3>
                                        <Card.Subtitle style={{ textAlign: 'center', marginBottom: '15px' }} >Cancelled Orders</Card.Subtitle>
                                    </Card.Title>
                                </Card.Body>
                            </Card>

                        </div>



                    </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <h2 style={{
                        color: 'black', fontFamily: 'IBM Plex Sans, sans-serif'
                    }}>Categories</h2>
                    <div style={{ display: 'flex', justifyContent: 'center', fontFamily: 'IBM Plex Sans, sans-serif' }}>
                        <div style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '10px', padding: '20px', border: '1px solid #ddd', borderRadius: '10px', marginRight: '10px' }}>
                            <img src="images/apple.png" alt="Cables" style={{ width: '100px', height: '100px' }} />
                            <div>
                                <h3>Chargers</h3>
                                <p>Brands: Apple/Sony</p>
                            </div>
                        </div>
                        <div style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '10px', padding: '20px', border: '1px solid #ddd', borderRadius: '10px', marginRight: '10px' }}>
                            <img src="images/samsungfridge.png" alt="Cables" style={{ width: 'auto', height: '100px' }} />
                            <div>
                                <h3>Refrigerators</h3>
                                <p>Brands: Samsung/Bosch</p>
                            </div>
                        </div>
                        <div style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '10px', padding: '20px', border: '1px solid #ddd', borderRadius: '10px', marginRight: '10px' }}>
                            <img src="images/bosch.png" alt="Cables" style={{ width: 'auto', height: '100px' }} />
                            <div>
                                <h3>Water Purifiers</h3>
                                <p>Brands: Kent/Eureka Forbes</p>
                            </div>
                        </div>
                        {/* <div  style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '10px', padding: '20px', border: '1px solid #ddd', borderRadius: '10px', marginRight: '10px' }}>
                            <img src="images/kirloskar.png" alt="Cables" style={{ width: 'auto', height: '100px' }} />
                            <div>
                                <h3>Pump</h3>
                                <p>Brands: Honda/Kirloskar</p>
                            </div>
                        </div> */}
                        <div style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '10px', padding: '20px', border: '1px solid #ddd', borderRadius: '10px', marginRight: '10px' }}>
                            <img src="images/sony.png" alt="Cables" style={{ width: '100px', height: '100px' }} />
                            <div>
                                <h3>Cables</h3>
                                <p>Brands: Apple/Samsung</p>
                            </div>
                        </div>
                        <div style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '10px', padding: '20px', border: '1px solid #ddd', borderRadius: '10px' }}>
                            <img src="images/bosch.png" alt="Cables" style={{ width: '100px', height: '100px' }} />
                            <div>
                                <h3>Home Automation</h3>
                                <p>Brands: Bosch/Syska</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div style={{ textAlign: 'center', fontFamily: 'IBM Plex Sans, sans-serif' }}>
                    <h2 style={{
                        color: 'black'
                    }}>Recent Orders</h2>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                        {/* Order #123 */}
                        <div /* onClick={() => handleOrderClick(123)} */ style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '10px', padding: '20px', border: '1px solid #ddd', borderRadius: '10px', marginRight: '10px' }}>
                            <img src="images/apple.png" alt="Cables" style={{ width: '100px', height: '100px' }} />

                            <div>
                                <h3>📦 Order #123</h3>
                                <p>🚚 Order on it's way</p>
                            </div>
                        </div>
                        {/* Order #124 */}
                        <div style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '10px', padding: '20px', border: '1px solid #ddd', borderRadius: '10px', marginRight: '10px' }}>
                            <img src="images/honda.png" alt="Cables" style={{ width: '100px', height: '100px' }} />
                            <div>
                                <h3>📦 Order #124</h3>
                                <p>🕜 Delivered on 27th Nov'23</p>
                            </div>
                        </div>
                        {/* Order #125 */}
                        <div style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '10px', padding: '20px', border: '1px solid #ddd', borderRadius: '10px', marginRight: '10px' }}>
                            <img src="images/mitsumini.png" alt="Cables" style={{ width: '100px', height: '100px' }} />
                            <div>
                                <h3>📦 Order #125</h3>
                                <p>💸 Payment Processing</p>
                            </div>
                        </div>
                        {/* Order #126 */}
                        <div style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '10px', padding: '20px', border: '1px solid #ddd', borderRadius: '10px', marginRight: '10px' }}>
                            <img src="images/ac.png" alt="Cables" style={{ width: '100px', height: '100px' }} />
                            <div>
                                <h3>📦 Order #126</h3>
                                <p>🕜 Delivered on 28th Nov'23</p>
                            </div>
                        </div>
                        {/* Order #127 */}
                        <div style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '10px', padding: '20px', border: '1px solid #ddd', borderRadius: '10px', marginRight: '10px' }}>
                            <img src="images/kirloskar.png" alt="Cables" style={{ width: '100px', height: '100px' }} />
                            <div>
                                <h3>📦 Order #127</h3>
                                <p>🛵 Order Out for Delivery</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {
                showDialog && (
                    <Dialog onClose={() => {
                        if (window.watsonAssistantChatInstance) {
                            const event = {
                                data: {
                                    context: {
                                        skills: {
                                            'actions skill': {
                                                skill_variables: { 'name': 'Ankit' }
                                            }
                                        }
                                    }
                                }
                            };
                            window.watsonAssistantChatInstance.openWindow(event);
                        }

                        // Close the dialog
                        setShowDialog(false);
                    }}>
                        {/* Dialog content */}
                    </Dialog>
                )
            }

            {/* Routes for ChargerCatalog */}
            <Routes>
                <Route path="/" element={<Home />} />
                {/* <Route path="/ChargerCatalog" element={<ChargerCatalog/>} /> */}
            </Routes>
            <Footer />
            {/* <AuthorSignature /> */}
        </div >

    );
}

export default LandingPage;
