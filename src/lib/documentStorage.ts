import { supabase } from './supabase';

export interface DocumentUpload {
  entityType: 'customer' | 'job' | 'quote' | 'invoice';
  entityId: string;
  documentType: string;
  file: File;
  notes?: string;
}

export interface Document {
  id: string;
  entity_type: string;
  entity_id: string;
  document_type: string;
  document_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  uploaded_by: string;
  uploaded_at: string;
  notes: string | null;
}

export class DocumentStorageService {
  private readonly BUCKET_NAME = 'documents';

  async uploadDocument(upload: DocumentUpload): Promise<Document> {
    const { file, entityType, entityId, documentType, notes } = upload;

    const fileExt = file.name.split('.').pop();
    const fileName = `${entityType}/${entityId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(this.BUCKET_NAME)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    const { data: { user } } = await supabase.auth.getUser();

    const { data: docData, error: docError } = await supabase
      .from('documents')
      .insert([{
        entity_type: entityType,
        entity_id: entityId,
        document_type: documentType,
        document_name: file.name,
        file_path: uploadData.path,
        file_size: file.size,
        mime_type: file.type,
        uploaded_by: user?.id,
        notes: notes || null
      }])
      .select()
      .single();

    if (docError) {
      await supabase.storage.from(this.BUCKET_NAME).remove([fileName]);
      throw new Error(`Failed to save document record: ${docError.message}`);
    }

    return docData;
  }

  async getDocuments(entityType: string, entityId: string): Promise<Document[]> {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('uploaded_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch documents: ${error.message}`);
    }

    return data || [];
  }

  async getDocumentUrl(filePath: string, expiresIn: number = 3600): Promise<string> {
    const { data, error } = await supabase.storage
      .from(this.BUCKET_NAME)
      .createSignedUrl(filePath, expiresIn);

    if (error) {
      throw new Error(`Failed to generate download URL: ${error.message}`);
    }

    return data.signedUrl;
  }

  async downloadDocument(document: Document): Promise<void> {
    const url = await this.getDocumentUrl(document.file_path);

    const link = window.document.createElement('a');
    link.href = url;
    link.download = document.document_name;
    link.click();
  }

  async deleteDocument(documentId: string): Promise<void> {
    const { data: doc, error: fetchError } = await supabase
      .from('documents')
      .select('file_path')
      .eq('id', documentId)
      .single();

    if (fetchError || !doc) {
      throw new Error('Document not found');
    }

    const { error: storageError } = await supabase.storage
      .from(this.BUCKET_NAME)
      .remove([doc.file_path]);

    if (storageError) {
      console.error('Failed to delete file from storage:', storageError);
    }

    const { error: dbError } = await supabase
      .from('documents')
      .delete()
      .eq('id', documentId);

    if (dbError) {
      throw new Error(`Failed to delete document record: ${dbError.message}`);
    }
  }

  async updateDocumentNotes(documentId: string, notes: string): Promise<void> {
    const { error } = await supabase
      .from('documents')
      .update({ notes })
      .eq('id', documentId);

    if (error) {
      throw new Error(`Failed to update document notes: ${error.message}`);
    }
  }
}

export const documentStorage = new DocumentStorageService();
