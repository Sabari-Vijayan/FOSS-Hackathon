#include <stdio.h>
#include <stdlib.h>

#pragma pack(push, 1) // Ensure no padding is added to structs
typedef struct {
    char signature[2];   // File signature ("BM")
    int fileSize;        // Size of the file
    int reserved;        // Reserved
    int dataOffset;      // Offset to pixel data
    int headerSize;      // Size of the header
    int width;           // Image width
    int height;          // Image height
    short planes;        // Number of color planes
    short bitsPerPixel;  // Bits per pixel
    int compression;     // Compression method
    int imageSize;       // Size of the image data
    int xPixelsPerMeter; // Horizontal resolution
    int yPixelsPerMeter; // Vertical resolution
    int colorsUsed;      // Number of colors used
    int importantColors; // Number of important colors
} BMPHeader;
#pragma pack(pop)

// Function to compress the BMP image using RLE
void compressBMP(const char *inputFile, const char *outputFile) {
    FILE *fin = fopen(inputFile, "rb");
    FILE *fout = fopen(outputFile, "wb");

    if (!fin || !fout) {
        perror("Error opening file");
        exit(EXIT_FAILURE);
    }

    // Read the BMP header
    BMPHeader header;
    fread(&header, sizeof(BMPHeader), 1, fin);

    // Verify the file is a BMP
    if (header.signature[0] != 'B' || header.signature[1] != 'M') {
        printf("Not a valid BMP file!\n");
        fclose(fin);
        fclose(fout);
        exit(EXIT_FAILURE);
    }

    // Write the BMP header to the output file
    fwrite(&header, sizeof(BMPHeader), 1, fout);

    // Move to the start of pixel data
    fseek(fin, header.dataOffset, SEEK_SET);

    // Allocate memory for pixel data
    unsigned char *pixels = (unsigned char *)malloc(header.imageSize);
    fread(pixels, 1, header.imageSize, fin);

    // Compress the pixel data using RLE
    int count = 1;
    for (int i = 1; i < header.imageSize; i++) {
        if (pixels[i] == pixels[i - 1] && count < 255) {
            count++;
        } else {
            fputc(count, fout);
            fputc(pixels[i - 1], fout);
            count = 1;
        }
    }

    // Write the last run
    fputc(count, fout);
    fputc(pixels[header.imageSize - 1], fout);

    free(pixels);
    fclose(fin);
    fclose(fout);
    printf("Image compressed successfully: %s\n", outputFile);
}

// Function to decompress the BMP image using RLE
void decompressBMP(const char *inputFile, const char *outputFile) {
    FILE *fin = fopen(inputFile, "rb");
    FILE *fout = fopen(outputFile, "wb");

    if (!fin || !fout) {
        perror("Error opening file");
        exit(EXIT_FAILURE);
    }

    // Read the BMP header
    BMPHeader header;
    fread(&header, sizeof(BMPHeader), 1, fin);

    // Verify the file is a BMP
    if (header.signature[0] != 'B' || header.signature[1] != 'M') {
        printf("Not a valid BMP file!\n");
        fclose(fin);
        fclose(fout);
        exit(EXIT_FAILURE);
    }

    // Write the BMP header to the output file
    fwrite(&header, sizeof(BMPHeader), 1, fout);

    // Decompress the pixel data
    int count, pixel;
    while ((count = fgetc(fin)) != EOF) {
        pixel = fgetc(fin);
        for (int i = 0; i < count; i++) {
            fputc(pixel, fout);
        }
    }

    fclose(fin);
    fclose(fout);
    printf("Image decompressed successfully: %s\n", outputFile);
}

int main() {
    char inputFile[100], compressedFile[100], decompressedFile[100];

    printf("Enter the input BMP file name: ");
    scanf("%s", inputFile);

    printf("Enter the compressed file name: ");
    scanf("%s", compressedFile);

    // printf("Enter the decompressed file name: ");
    // scanf("%s", decompressedFile);

    compressBMP(inputFile, compressedFile);

    // decompressBMP(compressedFile, decompressedFile);

    return 0;
}