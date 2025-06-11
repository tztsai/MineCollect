from unstructured.partition.pdf import partition_pdf
from unstructured.staging.base import elements_to_json

file_path = "../../data"
base_file_name = "5365-Article Text-8590-1-10-20200508"

def main():
    elements = partition_pdf(filename=f"{file_path}/{base_file_name}.pdf")
    elements_to_json(elements=elements, filename=f"{file_path}/{base_file_name}-output.json")

if __name__ == "__main__":
    main()