
import os
import time
import copy
import logging
import requests

from typing import Annotated

from main import Depends
from fastapi import APIRouter, Request, Cookie, HTTPException
# from starlette.requests import Request
from starlette.responses import RedirectResponse, Response
from fastapi.security import OAuth2PasswordBearer
import jwt

from requests.auth import HTTPBasicAuth

from core.log_config import init_loggers

init_loggers(__name__)
logger = logging.getLogger(__name__) 

router = APIRouter()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

@router.get("/api/auth/app-id/authorization", tags=["AUTH"], summary="Start Authentication using AppID")
async def startAuth(request: Request, response_type: str | None, redirect_uri: str | None, client_id: str | None, scope: str | None, urlAfterLogin: str | None):                     
    try:
        # logger.info(f"\n\n-------- IN AUTH_API.startAuth Type: request.args: {request.args}----------\n\n") 
        auth_url = os.environ["OAUTH_SERVER_URL"]+"/authorization"
        auth_url_with_params = f"{auth_url}?response_type={response_type}&redirect_uri={redirect_uri}client_id={client_id}&scope={scope}"
        logger.debug(f"\n\n-------- IN AUTH_API.startAuth Type: OAUTH_SERVER_URL: {auth_url_with_params}----------\n\n") 
        expiryDate = 3600       
        if urlAfterLogin is None:
            urlAfterLogin = request.headers.referer or ''
        
        logger.info(f"\n\n-------- IN AUTH_API.startAuth Type: urlAfterLogin: {urlAfterLogin}----------\n\n") 
        response = RedirectResponse("{}?client_id={}&response_type={}&redirect_uri={}&scope={}".format(auth_url, client_id, response_type, redirect_uri, scope))
        response.statusCode = 302
        response.set_cookie(key="urlAfterLogin", value=urlAfterLogin, max_age=3600, expires=expiryDate, httponly=True)
        return response
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid Auth details")


@router.get("/api/auth/app-id/callback", tags=["AUTH"], summary="After Authentication from AppID")
async def afterAuth(request: Request, code: str | None, urlAfterLogin: str | None = Cookie(None)):                     
    try:
        logger.debug(f"\n\n-------- IN AUTH_API.afterAuth: code: {code}----------\n\n") 
        # fullURL = request.url
        domain = str(request.base_url)
        domain = domain[:-1]
        # path = request.url.path
        # logger.info(f"-------- IN AUTH_API.afterAuth, \ndomain: {domain}, \nPATH: {path}, \nfullURL: {fullURL}----------")         
        auth_url = os.environ["OAUTH_SERVER_URL"]
        client_id = os.environ["CLIENT_ID"]
        client_secret = os.environ["CLIENT_SECRET"]
        redirect_uri = domain + os.environ["REDIRECT_URI"]
        token_endpoint = auth_url + "/token"
        resp = requests.post(token_endpoint,
                                data = {"client_id": client_id,
                                        "grant_type": "authorization_code",
                                        "redirect_uri": redirect_uri,
                                        "code": code},
                                auth = HTTPBasicAuth(client_id, client_secret))
        resp_json = resp.json()
        logger.debug(f"\n\n-------- IN AUTH_API.afterAuth Type: resp_json: {resp_json}----------\n\n")
        if "error_description" in resp_json:
            err_msg = "Could not retrieve user tokens, {}".format(resp_json["error_description"])
        elif "id_token" in resp_json and "access_token" in resp_json:
            if urlAfterLogin is None:
                urlAfterLogin = request.cookies.get('urlAfterLogin')
            logger.debug(f"Cookie Value of urlAfterLogin: {urlAfterLogin}")

            if urlAfterLogin is None:
                urlAfterLogin = request.headers.referer or ''

            redircet_to = urlAfterLogin+'?token='+resp_json["id_token"]

            response = RedirectResponse(redircet_to)    
            response.set_cookie(key='access_token', value=resp_json["access_token"], max_age=3600, expires=3600, httponly=False)
            response.set_cookie(key='id_token', value=resp_json["id_token"], max_age=3600, expires=3600, httponly=False)
            response.set_cookie(key='refresh_token', value=resp_json["refresh_token"], max_age=3600, expires=3600, httponly=False)
            response.statusCode = 302
            return response
        else:
            err_msg = "Did not receive 'id_token' and / or 'access_token'"
        return code
    except Exception as err:
        logger.error(err)
        raise HTTPException(status_code=403, detail="Invalid authorization code. Please login again.")


@router.get("/api/auth/app-id/userinfo", tags=["AUTH"], summary="Get User Details")
async def getUserInfo(token: Annotated[str, Depends(oauth2_scheme)]):                     
    try:
        if token is not None:  
            # token = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImFwcElkLTU1MzJmMjhmLWVmZjItNDNjZS1iODI5LTgwNGQwNzE4ZDAyYy0yMDI0LTAxLTIwVDA2OjQ1OjMyLjQ2MzkxMDAxMSIsInZlciI6NH0.eyJpc3MiOiJodHRwczovL3VzLXNvdXRoLmFwcGlkLmNsb3VkLmlibS5jb20vb2F1dGgvdjQvNTUzMmYyOGYtZWZmMi00M2NlLWI4MjktODA0ZDA3MThkMDJjIiwiYXVkIjpbImNmMjBjNjZlLTUzNWItNDlhNi1iOGFiLTMwZWY4ZmMzMjAyOSJdLCJleHAiOjE3MzI2MjE4NzMsInRlbmFudCI6IjU1MzJmMjhmLWVmZjItNDNjZS1iODI5LTgwNGQwNzE4ZDAyYyIsImlhdCI6MTczMjYxODI3MywiZW1haWwiOiJhZG1pbkBpYm0uY29tIiwibmFtZSI6IkFkbWluIFVzZXIiLCJzdWIiOiJmMWU4YTI3OS01ZDIzLTRlNGEtOWNhMi04YzVlYzZlOGYzODYiLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwiZ2l2ZW5fbmFtZSI6IkFkbWluIiwiZmFtaWx5X25hbWUiOiJVc2VyIiwiaWRlbnRpdGllcyI6W3sicHJvdmlkZXIiOiJjbG91ZF9kaXJlY3RvcnkiLCJpZCI6IjY5MjQwMGFkLWViN2QtNDc5MC1hOGMzLTU2ZmU3NjNlZGZiMCJ9XSwiYW1yIjpbImNsb3VkX2RpcmVjdG9yeSJdLCJyb2xlcyI6WyJhZG1pbiJdfQ.Gh-xWkS2A1BhSsfRQBaYhlUofwQzOxHgp92JeduzUG_PMJiGTkS0x4uSBrAGmxMJhwJmNBcO8oVt6K3IepMq7tO4AYmZJsIuTv11mpyAI-tx6Ltr0RSSR8--5AwJlE2eRxpPG03YAOlSvYceBxjeDQ6d4buu3ICpiPMuK1s7xZLP000Ni9WD_agcRSfhmpfYI3ufsmo-_bx_bj7Izv2s6mqX4SnzXmd4mv-H8RhhIfGXzKoEjyM7T48dI2h-EUTC9-Tsp8sp-oDx_um8785FZAt4ObDe4ZRPaOszV8hwj-OGlnrMaqgweGsohFQVZfiQINoQdRtx_psrwIlwgSpNCA"          
            decoded_token = decodeJWT(token=token)
            logger.debug(f"\n\n-------- IN AUTH_API.getUserInfo decoded_token: {decoded_token}\n\n") 
            return decoded_token       
    except Exception as err:
        logger.error(err)
        raise HTTPException(status_code=401, detail="Invalid authorization token.  Please login again.")
    
@router.get("/api/auth/app-id/logout", tags=["AUTH"], summary="Logout from Application")
async def logout(request: Request, response: Response):                     
    try:
        logger.debug(f"\n\n-------- IN AUTH_API.logout: ----------\n\n") 
        # fullURL = request.url
        response.delete_cookie("access_token")
        response.delete_cookie("id_token")
        response.delete_cookie("refresh_token")
        return {"status":"success"}

    except Exception as err:
        logger.error(err)
        raise HTTPException(status_code=403, detail="Invalid authorization code.")

def decodeJWT(token: str) -> dict:
    try:        
        publicKey = os.environ["JWT_PUBLIC_KEY"]
        decodeKey = publicKey.replace(r'\n', '\n')
        logger.debug(f"\n\n-------- IN AUTH_API.decodeJWT: decodeKey: {decodeKey}----------\n\n") 
        decoded_token = jwt.decode(token, decodeKey, algorithms="[RS256]", options={"verify_aud": False, "verify_signature": False})
        # logger.debug(f"\n\n-------- IN AUTH_API.decodeJWT: decoded_token: {decoded_token}----------\n\n") 
        appIdUser = copy.deepcopy(decoded_token) 
        appIdUser["id"] = decoded_token["sub"]
        if appIdUser["exp"] <= time.time():
            logger.error(f"\n\n\n  <<<<<<<<<<<<<< TOKEN EXPIRED >>>>>>>>>>>> \n\n\n")
            raise HTTPException(status_code=401, detail="Token Expired.  Please login again.")
        # logger.debug(f"\n\n-------- IN AUTH_API.decodeJWT: appIdUser: {appIdUser}----------\n\n") 
        return appIdUser
    except HTTPException as httpE:
       raise httpE
    except Exception as err:
       logger.error(err)
       raise HTTPException(status_code=401, detail="Invalid authorization token.")
    
