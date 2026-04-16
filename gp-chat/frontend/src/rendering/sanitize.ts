import DOMPurify from 'dompurify';

export function sanitize(html: string): string {
  return DOMPurify.sanitize(html, {
    ADD_TAGS: ['card', 'statgrid', 'stat', 'datatable'],
    ADD_ATTR: ['title', 'label', 'value', 'sub', 'color'],
    FORBID_TAGS: ['script', 'style', 'iframe'],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  });
}
