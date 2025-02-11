from pydantic import BaseModel




class ArticleTimeData(BaseModel):
    ARTICLE_IDENTIFIER: str
    ORDERID: str
    CAB_INFO3: str
    ARTICLE_ID: str
    EMPLOYEEID: str
    RESOURCE: str
    CUSTOMERID: str