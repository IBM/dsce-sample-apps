import dash
from dash import dcc, html, Input, Output, State, ctx, dash_table
import dash_uploader as du
import dash_bootstrap_components as dbc
import base64
import os
import shutil
from dotenv import load_dotenv
from PIL import Image
from io import BytesIO
from utils import *
from jproperties import Properties
from flask import send_from_directory
import datetime

# Load environment variables
load_dotenv()

# instantiate config
configs = Properties()
# load properties into configs
with open('app-config.properties', 'rb') as config_file:
    configs.load(config_file)
# read into dictionary
configs_dict = {}
items_view = configs.items()
for item in items_view:
    configs_dict[item[0]] = item[1].data


# Dash app initialization
app = dash.Dash(external_stylesheets=[dbc.themes.BOOTSTRAP, dbc.icons.BOOTSTRAP, 'https://fonts.googleapis.com/css?family=IBM+Plex+Sans:400,600&display=swap'])

app.title = configs_dict['tabtitle']

navbar_main = dbc.Navbar([
                    dbc.Col(children=[html.A(configs_dict['navbartitle'], href=os.getenv("HEADER_URL"), target='_blank', style={'color': 'white', 'textDecoration': 'none'})],
                        style={'fontSize': '0.875rem','fontWeight': '600'},
                    ),
                    # dbc.DropdownMenu(
                    #     children=[
                    #         dbc.DropdownMenuItem("View payload", id="payload-button", n_clicks=0, class_name="dmi-class"),
                    #     ],
                    #     toggle_class_name="nav-dropdown-btn", caret=False,
                    #     nav=True, in_navbar=True,
                    #     label=html.Img(src="/assets/settings.svg", height="16px", width="16px", style={'filter': 'invert(1)'}),
                    #     align_end=True,
                    # ),
        ],
    style={
        'paddingLeft': '1rem',
        'height': '3rem',
        'borderBottom': '1px solid #393939',
        'color': '#fff',
        'position': 'fixed',  # Fix the navbar at the top
        'top': '0',  # Position it at the very top
        'width': '100%',  # Ensure it spans the full width of the page
        'zIndex': '1000',  # Keep it above other elements
    },
    class_name = "bg-dark"
)

samplefiles= html.Div([
    html.H5("Download sample files, URL"),
    html.Ul([
        html.Li([html.A("product-1 : "),html.A("sample file", href="/static/product-1.zip", download="product-1.zip"),", ",html.A("URL", href="https://www.amazon.com/SKINNYDIPPED-Chocolate-Covered-Almonds-Resealable/dp/B077GCSMX4/", target="_blank")]),
        html.Li([html.A("product-2 : "),html.A("sample file", href="/static/product-2.zip", download="product-2.zip"),", ",html.A("URL", href="https://www.amazon.com/Womens-Skyline-Float-Sneaker-Azure-Twilight/dp/B0CPBZ2LRG/", target="_blank")]),
        html.Li([html.A("product-3 : "),html.A("sample file", href="/static/product-3.zip", download="product-3.zip"),", ",html.A("URL", href="https://www.amazon.com/Apple-Cancellation-Transparency-Personalized-High-Fidelity/dp/B0D1XD1ZV3/", target="_blank")])
    ])
])

generate_button = dbc.Button(
    configs_dict['generate_btn_text'], id="process-button", color="primary", n_clicks=0, className="carbon-btn"
)

reset_button = dbc.Button(
    "Reset", id="reset-button", color="primary", outline=True, n_clicks=0, className="carbon-btn"
)

footer = html.Footer(
    dbc.Row([
        dbc.Col(children=[dcc.Markdown(configs_dict['footer_text'])],className="p-3 pb-0")]),
    style={'paddingLeft': '1rem', 'paddingRight': '5rem', 'color': '#c6c6c6', 'lineHeight': '22px'},
    className="bg-dark position-fixed bottom-0"
)

du.configure_upload(app, "./uploads")

# List of messages to display
messages = [
    "Finding the category and sub-category for the given product image.",
    "Retrieving attributes for the identified category.",
    "Extracting attribute values from the product image."
]

image_loading_message="Combining multiple images into a single image."

# App layout
app.layout = html.Div([
    # Header
    navbar_main,

    # Main content
    html.Div(
        className="main-content",
        children=[
            dbc.Row([
                # Sidebar
                dbc.Col([
                    
                    # Sample files
                    samplefiles,
                    
                    # Image uploader
                    html.H5("Image upload", className="mb-3"),
                    du.Upload(
                        id="image-uploader",
                        text="Drag and Drop or Click to Upload",
                        max_file_size=10,  # Max file size in MB
                        filetypes=["jpg", "jpeg", "png", "webp"],
                        max_files=8,
                    ),
                    html.Div(
                        id="uploaded-files-summary",
                        children="No files uploaded yet.",
                        style={"fontWeight": "bold", "marginTop": "10px"}
                    ),
                    html.Ul(
                        id="uploaded-files-list",
                        className="list-group mt-2",
                        style={"maxHeight": "150px", "overflowY": "auto", "border": "1px solid #ccc", "padding": "10px"}
                    ),
                    html.P("Note: Maximum 8 files. Supported formats: PNG, JPG, JPEG, WEBP", className="text-muted mt-2"),
                    html.H5("Enter a URL", className="mt-4"),
                    dbc.Input(id="url-input", type="text", placeholder="Enter URL here", className="mb-3"),
                    #dbc.Input(id="url-input", type="text", placeholder="Enter URL here", className="mb-3 d-none"),
                    generate_button,
                    html.Div(
                        id="process-status",
                        children="",
                        style={"marginTop": "10px", "fontStyle": "italic", "color": "red"}
                    ),
                    reset_button,
                ], width=3, style={"borderRight": "2px solid #ccc", "padding": "20px", "paddingBottom": "270px"}),

                # Image preview
                dbc.Col([
                    html.H5("Image preview", className="mb-3"),
                    html.P(configs_dict["helper_text_image_preview"], style={"color": "#525252", "fontSize": "1rem", "fontStyle": "italic"}),
                    dcc.Loading(
                        id="loading-spinner",
                        type="circle",
                        children=html.Div(
                            id="image-display",
                            style={"marginBottom": "20px", "textAlign": "center", "padding": "10px", "maxHeight": "920px", "overflowY": "auto"}
                        )
                    )
                    # ,
                    # html.Div(id="image-loading-message", style={"textAlign": "center", "marginTop": "10px", "fontSize": "16px", "color": "#007BFF"}),
                ], width=4, style={"borderRight": "2px solid #ccc", "padding": "20px"}),

                # Metadata display
                dbc.Col([
                    html.H5("Extracted metadata", className="mb-3"),
                    html.P(configs_dict["helper_text_extracted_metadata"], style={"color": "#525252", "fontSize": "1rem", "fontStyle": "italic"}),
                    dcc.Loading(
                        id="metadata-loading-spinner",
                        type="circle",
                        children=html.Div(
                            id="metadata-table",
                            style={"overflow": "hidden", "padding": "10px", "borderRadius": "5px"}
                        )
                    ),
                    html.Div(id="loading-message", style={"textAlign": "center", "marginTop": "10px", "fontSize": "16px", "color": "#007BFF"}),
                    dcc.Interval(
                        disabled=True,
                        id="interval-component",
                        interval=20 * 1000,  # 20 seconds
                        n_intervals=0  # Number of intervals that have passed
                    )
                ], width=5, style={"padding": "20px"})
            ])
        ],
        style={"marginTop": "3rem", "paddingBottom": "60px", "paddingLeft": "15px","paddingRight": "15px"}
    ),

    # Footer
    footer
])

# @app.callback(
#     Output("image-loading-message", "children"),
#     Input("process-button", "n_clicks"),
#     prevent_initial_call = True
# )
# def image_update_message(n):
#     return image_loading_message

@app.callback(
    Output("metadata-table", "children",  allow_duplicate=True),
    Output("loading-message", "children"),
    Output("interval-component", "disabled",  allow_duplicate=True),
    Input("interval-component", "n_intervals"),
    Input("process-button", "n_clicks"),
    prevent_initial_call = True
)
def update_message(n_intervals, n):
    # Cycle through messages based on the interval count
    if(n_intervals>=3):
        return  None,  messages[-1], False
    return  None,  messages[n_intervals % len(messages)], False

@app.callback(
    [Output("image-display", "children", allow_duplicate=True),
     Output("metadata-table", "children",  allow_duplicate=True),
     Output("uploaded-files-list", "children"),
     Output("uploaded-files-summary", "children"),
     Output("process-status", "children"),
     Output("url-input", "value"),
     Output("image-uploader", "fileNames")],
     Output('interval-component', 'disabled'),
     Output("loading-message", "children", allow_duplicate=True),
    [Input("process-button", "n_clicks"),
     Input("reset-button", "n_clicks")],
    [State("image-uploader", "fileNames"),
     State("url-input", "value"),
     State("image-uploader", "upload_id")],
    prevent_initial_call = True
     
)
def process_inputs(process_clicks, reset_clicks, uploaded_files, url_input, upload_id):
    print("process_inputs: start")
    ctx_triggered = ctx.triggered_id
    main_start = datetime.datetime.now()
    if ctx_triggered == "reset-button":
        upload_dir = os.path.join("./uploads/")
        shutil.rmtree(upload_dir, ignore_errors=True)
        return None, None, [], "No files uploaded yet.", "", "", None, True, None
    


    if ctx_triggered == "process-button":
        print("process-button: start")
        uploaded_files_list = [html.Li(file, className="list-group-item") for file in (uploaded_files or [])]        
        summary = f"{len(uploaded_files)} files uploaded" if uploaded_files else "No files uploaded yet."
        
        image_divs = []
        metadata_records = []
        # Process uploaded images
        if uploaded_files and upload_id:
            upload_dir = os.path.join("./uploads", upload_id)
            #shutil.rmtree(upload_dir, ignore_errors=True)
            combined_image_path = os.path.join(upload_dir, "combined_image.png")
            os.makedirs(upload_dir, exist_ok=True)

            try:
                images = []
                for file_name in uploaded_files:
                    try:
                        file_path = os.path.join(upload_dir, file_name)
                        # isFileValidated=validate_uploaded_files_with_hash(file_path)
                        # #print("isFileValidated",isFileValidated)
                        # if isFileValidated == False :
                        #     return None, None, uploaded_files_list, summary, "Please upload given sample files only.", url_input, uploaded_files, None 
                        img = Image.open(file_path)
                        images.append(img)
                    except Exception as e: 
                        print(e)
                        continue  # Skip invalid images
                
                if images:
                    standardized_width = 400
                    resized_images = [
                        img.resize((standardized_width, int(img.height * (standardized_width / img.width))))
                        for img in images
                    ]
                    total_height = sum(img.height for img in resized_images)
                    combined_image = Image.new("RGB", (standardized_width, total_height), "white")
                    y_offset = 0
                    for img in resized_images:
                        combined_image.paste(img, (0, y_offset))
                        y_offset += img.height

                    combined_image.save(combined_image_path)

                    # Prepare base64 encoded image
                    with open(combined_image_path, "rb") as img_file:
                        base64_image = prepare_image_for_encoding(BytesIO(img_file.read()))

                    # Determine category
                    category = get_category(base64_image)
                    if "not able to provide assistance" in category:
                        return html.Div("The AI model couldn't process the image. Please ensure the image is clear, focused on the main product, free of watermarks, and copyright-compliant. Avoid uploading images with multiple items or irrelevant elements. Try again with a well-lit, properly framed product image.", style={"color": "red"}), None, uploaded_files_list, summary, "Error in category detection.", url_input, uploaded_files, True, None
                    else:
                        metadata = get_image_metadata(base64_image, category)
                        if metadata:
                            metadata_records.append(clean_and_parse_json(metadata))

                    image_divs.append(html.Img(src=f"data:image/png;base64,{base64.b64encode(open(combined_image_path, 'rb').read()).decode()}", style={"maxWidth": "100%"}))
                else:
                    return html.Div("No valid images uploaded.", style={"color": "red"}), None, uploaded_files_list, summary, "Processing failed.", url_input, uploaded_files, True, None
            except Exception as e:
                return html.Div(f"Error processing images: {str(e)}", style={"color": "red"}), None, uploaded_files_list, summary, "Error in processing images.", url_input, uploaded_files, True, None
            # finally:
            #     # Clean up temporary files
            #     if not url_input.strip():
            #         shutil.rmtree(upload_dir, ignore_errors=True)

        # Process URL input
        if url_input:
            url_input=url_input.strip()
            # Sample URLs
            valid_urls = [
                "https://www.amazon.com/SKINNYDIPPED-Chocolate-Covered-Almonds-Resealable/dp/B077GCSMX4/",
                "https://www.amazon.com/Womens-Skyline-Float-Sneaker-Azure-Twilight/dp/B0CPBZ2LRG/",
                "https://www.amazon.com/Apple-Cancellation-Transparency-Personalized-High-Fidelity/dp/B0D1XD1ZV3/"
            ]
            if url_input not in valid_urls:
                return html.Div(f"", style={"color": "red"}), None, uploaded_files_list, summary, "Please enter sample URL only.", url_input, uploaded_files, True, None
            
            try:
                refined_content = process_url_content(url_input)
                if refined_content:
                    url_metadata = generate_llm_response_for_url(refined_content)
                    if url_metadata:
                        metadata_records.append(clean_and_parse_json(url_metadata))
            except Exception as e:
                return html.Div(f"Error processing URL: {str(e)}", style={"color": "red"}), None, uploaded_files_list, summary, "Error in processing URL.", url_input, uploaded_files, True, None
            # finally:
            #     # Clean up temporary files
            #     if not (uploaded_files and upload_id):
            #         shutil.rmtree(upload_dir, ignore_errors=True)

        # Combine metadata
        if metadata_records:
            metadata_df = combine_metadata(metadata_records)
            table = dash_table.DataTable(
                data=metadata_df.to_dict("records"),
                columns=[{"name": col, "id": col} for col in metadata_df.columns],
                style_table={"overflowX": "auto", "border": "1px solid #ccc", "borderRadius": "5px", "padding": "10px"},
                style_header={"backgroundColor": "rgb(211, 211, 211)", "color": "black", "fontWeight": "bold"},
                style_data={"whiteSpace": "normal", "height": "auto", "fontFamily": "Arial, sans-serif", "fontSize": "14px"},
                style_cell={"textAlign": "center"},
                style_as_list_view=True
            )
            main_end = datetime.datetime.now()
            print("Final output call: ",main_end-main_start)
            return image_divs, table, uploaded_files_list, summary, "", url_input, uploaded_files, True, None
        
        return image_divs, dbc.Alert(dcc.Markdown(configs_dict["error_msg_empty_input"]), color="danger"), uploaded_files_list, summary, "", url_input, uploaded_files, True, None

    return None, None, [], "No files uploaded yet.", "", "", None, True, None

# Configure Flask to serve the static folder
@app.server.route('/static')
def serve_static(path):
    static_folder = os.path.join(os.getcwd(), "static")
    return send_from_directory(static_folder, path)

if __name__ == "__main__":
    SERVICE_PORT = os.getenv("SERVICE_PORT", default="8050")
    DEBUG_MODE = eval(os.getenv("DEBUG_MODE", default="True"))
    app.run(host="0.0.0.0", port=SERVICE_PORT, debug=DEBUG_MODE, dev_tools_hot_reload=False)
