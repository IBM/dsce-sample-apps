"""
Main script to run the Health Coverage Q&A Agent.
"""

import os
import sys
from dotenv import load_dotenv
from document_loader import DocumentProcessor
from agent import RAGQandAAgent


def setup_environment():
    """Load environment variables and validate configuration."""
    load_dotenv()

    # Validate required watsonx.ai credentials
    required_vars = ['WATSONX_APIKEY', 'WATSONX_URL', 'WATSONX_PROJECT_ID']
    missing_vars = [var for var in required_vars if not os.getenv(var)]

    if missing_vars:
        print("Error: Missing required watsonx.ai environment variables:")
        for var in missing_vars:
            print(f"  - {var}")
        print("\nPlease create a .env file with your watsonx.ai credentials:")
        print("  WATSONX_APIKEY=your-api-key")
        print("  WATSONX_URL=https://us-south.ml.cloud.ibm.com")
        print("  WATSONX_PROJECT_ID=your-project-id")
        sys.exit(1)

    # Build credentials dictionary
    credentials = {
        'apikey': os.getenv('WATSONX_APIKEY'),
        'url': os.getenv('WATSONX_URL'),
        'project_id': os.getenv('WATSONX_PROJECT_ID'),
        'llm_model': os.getenv('WATSONX_LLM_MODEL', 'meta-llama/llama-3-1-70b-instruct'),
        'embedding_model': os.getenv('WATSONX_EMBEDDING_MODEL', 'ibm/slate.125m.english.rtrvr')
    }

    return credentials


def initialize_agent(watsonx_credentials: dict):
    """Initialize the document processor and agent."""
    print("=" * 60)
    print("Report Q&A Agent")
    print("=" * 60)
    print()
    print(f"Using watsonx.ai LLM: {watsonx_credentials['llm_model']}")
    print(f"Using watsonx.ai Embeddings: {watsonx_credentials['embedding_model']}")
    print()

    # Get document path from environment variable
    document_path = os.getenv("REPORT_DOC")

    # Initialize document processor
    print("Step 1: Loading and processing documents...")
    if document_path:
        print(f"Using document from .env: {document_path}")
        doc_processor = DocumentProcessor(
            watsonx_credentials=watsonx_credentials,
            document_path=document_path
        )
    else:
        print("No REPORT_DOC set, loading all documents from docs/")
        doc_processor = DocumentProcessor(
            watsonx_credentials=watsonx_credentials,
            docs_dir="docs"
        )

    try:
        vectorstore = doc_processor.setup()
    except Exception as e:
        print(f"Error loading documents: {e}")
        sys.exit(1)

    print()
    print("Step 2: Initializing Q&A agent...")
    agent = RAGQandAAgent(vectorstore, watsonx_credentials)
    print("Agent ready!")
    print()

    return agent


def run_interactive_mode(agent: RAGQandAAgent):
    """Run the agent in interactive mode."""
    print("=" * 60)
    print("Interactive Q&A Mode - Conversational Assistant")
    print("=" * 60)
    print()
    print("Ask questions about your health coverage policies.")
    print("I'll remember our conversation, so feel free to ask follow-up questions!")
    print()
    print("Commands:")
    print("  - 'quit' or 'exit': End the session")
    print("  - 'reset': Start a new conversation")
    print("  - 'help': See example questions")
    print()

    while True:
        try:
            question = input("\nYou: ").strip()

            if not question:
                continue

            if question.lower() in ['quit', 'exit', 'q']:
                print("\nThank you for using the Health Coverage Q&A Agent!")
                break

            if question.lower() == 'reset':
                agent.reset_conversation()
                print("\n✓ Conversation reset. Starting fresh!")
                continue

            if question.lower() == 'help':
                print_example_questions()
                continue

            # Get response from agent
            answer = agent.query(question)
            print(f"\nAgent: {answer}")

        except KeyboardInterrupt:
            print("\n\nSession interrupted. Goodbye!")
            break
        except Exception as e:
            print(f"\nError processing question: {e}")
            print("Please try again with a different question.")


def run_single_query(agent: RAGQandAAgent, question: str):
    """Run a single query and exit."""
    print(f"\nQuestion: {question}")
    print("\nThinking...\n")

    try:
        answer = agent.query(question)
        print(f"Answer: {answer}")
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


def print_example_questions():
    """Print example questions users can ask."""
    print("\nExample conversation starters:")
    print("  - I'm trying to understand my new health insurance plan")
    print("  - What's the deductible and how does it work?")
    print("  - What if I need to see my doctor?")
    print("  - How much would an emergency room visit cost?")
    print("  - Is preventive care covered?")
    print("  - What about prescriptions?")
    print("  - Do I need a referral to see a specialist?")
    print("  - How important is it to stay in-network?")
    print("\nTip: You can ask follow-up questions - I'll remember our conversation!")


def main():
    """Main entry point."""
    watsonx_credentials = setup_environment()
    agent = initialize_agent(watsonx_credentials)

    # Check if a question was provided as command-line argument
    if len(sys.argv) > 1:
        question = " ".join(sys.argv[1:])
        run_single_query(agent, question)
    else:
        run_interactive_mode(agent)


if __name__ == "__main__":
    main()
