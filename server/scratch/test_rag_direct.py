import os
import sys
import time

# Ensure we can import from server
server_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if server_dir not in sys.path:
    sys.path.insert(0, server_dir)

from app import app, build_project_context_for_question, db
from models import Project, ProjectFile

def test_rag():
    with app.app_context():
        print("--- RAG Test Starting ---")
        
        # 0. Ensure a test user exists
        from models import User
        user = User.query.filter_by(email="rag_test@example.com").first()
        if not user:
            print("Creating test user...")
            user = User(
                display_name="rag_test_user",
                email="rag_test@example.com",
                password_hash="dummy_hash", # not used for this test
            )
            db.session.add(user)
            db.session.commit()

        # 1. Ensure a test project exists
        project = Project.query.filter_by(name="RAG_Test_Project").first()
        if not project:
            print("Creating test project...")
            project = Project(
                name="RAG_Test_Project", 
                description="A project for testing RAG features.",
                user_id=user.id
            )
            db.session.add(project)
            db.session.commit()
        
        # 2. Ensure a test file exists
        test_file_name = "test_logic.py"
        test_content = """
def calculate_secret_number():
    # The secret number is the sum of 42 and 1337
    return 42 + 1337

def get_author_name():
    return "Code Alchemist"
"""
        pf = ProjectFile.query.filter_by(project_id=project.id, name=test_file_name).first()
        if not pf:
            print(f"Creating test file: {test_file_name}")
            pf = ProjectFile(project_id=project.id, name=test_file_name, content=test_content, language="python")
            db.session.add(pf)
            db.session.commit()
        else:
            print(f"Test file already exists: {test_file_name}")
            pf.content = test_content
            db.session.commit()

        # 3. Test RAG retrieval
        question = "What is the secret number formula?"
        print(f"Question: {question}")
        
        start_time = time.time()
        context = build_project_context_for_question(project.id, question)
        duration = time.time() - start_time
        
        print(f"RAG took {duration:.2f} seconds")
        print("--- Context Found ---")
        print(context)
        print("---------------------")
        
        if "42 + 1337" in context:
            print("SUCCESS: RAG retrieved the correct context!")
        else:
            print("FAILURE: RAG did not find the relevant logic.")

if __name__ == "__main__":
    try:
        test_rag()
    except Exception as e:
        print(f"An error occurred: {e}")
        import traceback
        traceback.print_exc()
