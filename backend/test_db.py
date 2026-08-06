import libsql_experimental as libsql
from sqlalchemy import create_engine
import os

url = "libsql://nitatime-cozyneurons.aws-ap-south-1.turso.io"
auth_token = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODYwNDU0NDYsImlkIjoiMDE5ZmQ4OTctNmIwMS03ODJlLTkxYjMtZDM0NGRmOGI2NGQ0Iiwia2lkIjoicU45X0szbmI3YS1ycjdfYzY1bHNCVFFqRER5NF92UHl5TUxKV2pWTUhVMCIsInJpZCI6IjkzNDMxZWNkLTA3YzktNDdmYS1iODRiLTExYjY2ODZjOGU1OCJ9.vOOqSfqrupJtAVlRFL-buRMa9FxhWUoYXgLNR39z8ukps7GVy59V7kXgOFeBhv0pRPyk0BRsIpc3FZaBLkVpBg"

host = url.replace("libsql://", "")

def _creator():
    conn = libsql.connect(database=host, auth_token=auth_token)
    class LibsqlConnectionWrapper:
        def __init__(self, c):
            self._c = c
        def __getattr__(self, name):
            return getattr(self._c, name)
        def create_function(self, *args, **kwargs):
            pass
    return LibsqlConnectionWrapper(conn)

engine = create_engine("sqlite://", creator=_creator)
with engine.connect() as conn:
    print("SUCCESS")
