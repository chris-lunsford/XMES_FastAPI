from pydantic import BaseModel


class PartUsageData(BaseModel):
    Barcode: str 
    Description: str
    Cab_Info3: str
    OrderID: str
    Article_ID: str     
    EmployeeID: str
    Resource: str
    CustomerID: str    
    Status: str
    Used_OrderID: str
    Used_AriticleID: str
    Used_Identifier: str



class ArticleTimeData(BaseModel):
    ARTICLE_IDENTIFIER: str
    ORDERID: str
    CAB_INFO3: str
    ARTICLE_ID: str
    EMPLOYEEID: str
    RESOURCE: str
    CUSTOMERID: str