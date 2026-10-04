export interface PhotoInterface{
    upload(file: Buffer): Promise<string>;
    delete(photoId: string): Promise<boolean>
    get(photoId: string): Promise<string>
}