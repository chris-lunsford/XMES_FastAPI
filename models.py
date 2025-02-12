from pydantic import BaseModel


class PartUsageData(BaseModel):
    Barcode: str 
    Description: str
    OrderID: str 
    Cab_Info3: str
    EmployeeID: str
    Resource: str
    CustomerID: str
    Article_ID: str
    Status: str
    PartDestination: str



class ArticleTimeData(BaseModel):
    ARTICLE_IDENTIFIER: str
    ORDERID: str
    CAB_INFO3: str
    ARTICLE_ID: str
    EMPLOYEEID: str
    RESOURCE: str
    CUSTOMERID: str