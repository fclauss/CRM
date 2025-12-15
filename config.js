/**
 * ================================================================
 * CONFIGURATION FILE
 * ================================================================
 * This file centralizes all settings for the CRM application.
 * Edit the values here to change templates, folders, or sheet names
 * without touching the main application code.
 * ================================================================
 */
const CONFIG = {
  // --- IDs for Google Drive files and folders ---
  "google_api": {
    "quote_template_id": "1wqy9BREhSO458CCYEreSqyK8JBla5JHIRFuKYjacQFQ",
    "quote_destination_folder_id": "1xJR8IZY2-iFAZYij77SWCPj5SQ-8XF3C",
    "email_template_doc_id": "1I1CsMvMJ6ZyRHzqOEMkf0THoe7NBwpEIbtP0unRGw4Q",
    "invoice_template_id" : "1V-l2zwbkCRxrHOudgZLnoApOSkSqXeGypxH3cUown0Q"
  },

   // --- NEW: Beneficiary Details for QR Code ---
  "beneficiary_details": {
    "name": "Style et Matière",
    "iban": "FR7615135090170800341513376", 
    "bic": "CEPAFRPP513" 
  },

  // --- Names of sheets within your main spreadsheet ---
  "file_paths": {
    "crm_sheet_name": "Form Responses 1", // The main sheet with client data
    "services_sheet_name": "Services",                 // The sheet listing your services and prices
    "import_sheet_name": "Import_Clients"              // The sheet used for bulk client import
  },

  // --- General quote settings ---
  "quote_settings": {
    "validity_days": 90
  },

  // --- Email settings ---
  "email_settings": {
    "subject_template": "Style et Matière - Devis n° {{DEVIS_NUMERO}} pour {{CLIENT_NAME}}",
    "sender_name": "Stéphane Mattel"
  },

  // --- Mapping of logical names to the exact column headers in your CRM sheet ---
  // This makes the script resilient to column reordering.
  "column_mappings": {
    "timestamp": "Timestamp",
    "request_type": "Type de demande",
    "client_type": "Type de client",
    "client_name": "Nom du Client / Raison Sociale",
    "contact_principal": "Nom du Contact Principal",
    "address": "Adresse",
    "postal_code": "Code Postale",
    "city": "Ville",
    "client_email": "Adresse Email",
    "phone": "Numero de Telephone",
    "project_details": "Détail du Projet / Information complémentaires",
    "work_type": "Type de travaux (pour calcul TVA)",
    "quote_number": "Devis N°",
    "quote_date": "Date du Devis",
    "status": "Statut du Devis",
    "estimated_duration": "Délai Estimé",
    "discount_percentage": "Pourcentage de remise",
    "quote_link": "Lien vers le Devis",
    "quote_data_json": "Quote Data (JSON)",
    "project_start_date": "Date Début Projet",
    "project_end_date": "Date Fin Projet Prévue",
    "project_value": "Valeur du projet",
    "invoice_number": "Facture N°",
    "invoice_date": "Date de Facture",
    "invoice_link": "Lien vers la Facture",
    "invoice_status": "Statut de la Facture",
    "invoice_data_json": "Invoice Data (JSON)",
    "internal_notes": "Notes Internes",
  },

  // --- Standardized status and work type values ---
  "statuses": {
    "NEW": "Nouveau",
    "SENT": "Devis envoyé",
    "WON": "Projet gagné",
    "COMPLETED": "Terminé",
    "CANCELLED": "Annulé"
  },
  "invoice_statuses": { 
    "DRAFT": "Brouillon",
    "SENT": "Envoyée",
    "PAID": "Payée"
  },
  "work_types": {
    "RENOVATION": "Rénovation (TVA 10%)",
    "NEW_CONSTRUCTION": "Construction neuve -2ans (TVA 20%)",
    "SUBCONTRACTING": "Sous-traitance (TVA 20%)",
    "COLLECTIVITY": "Collectivité (TVA 20%)"
  },
  "tva_rate": {
    'Rénovation (TVA 10%)': 10,
    'Construction neuve -2ans (TVA 20%)': 20,
    'Sous-traitance (TVA 20%)': 20,
    'Collectivité (TVA 20%)': 20
  },
  "email_templates": {
    "quote": {
      "subject": "Style et Matière - Devis n° {{QUOTE_NUMBER}} pour {{CLIENT_NAME}}",
      "body": `Bonjour {{CLIENT_NAME}},
  
    Suite à votre demande, veuillez trouver ci-joint le devis pour vos travaux de {{WORK_TYPE}}.

    Ce devis est valable jusqu'au {{VALIDITY_DATE}}.

    N’hésitez pas à me contacter si vous avez des questions ou si vous souhaitez des précisions complémentaires.

    Je vous serais reconnaissant de bien vouloir me confirmer la bonne réception du document.
    Merci pour l’intérêt que vous portez à mon entreprise.

    Bien cordialement,

    Stéphane Mattel
    Gérant – Style et Matière
    5, route de Lobsann
    67250 Lampertsloch
    Tél: 06.38.70.45.76`
      },
      
      "followup": {
        "subject": "Style et Matière - Relance devis n° {{QUOTE_NUMBER}}",
        "body": `Bonjour {{CLIENT_NAME}},

    Je me permets de revenir vers vous concernant le devis n° {{QUOTE_NUMBER}} que je vous ai envoyé le {{QUOTE_DATE}} pour vos travaux de {{WORK_TYPE}}.

    **Rappel du devis:**
    - Montant total TTC: {{TOTAL_AMOUNT}}
    - Validité: {{VALIDITY_DATE}}

    Avez-vous eu l'occasion de l'examiner ? Avez-vous des questions ou souhaitez-vous des précisions ?

    Je reste à votre entière disposition pour en discuter.

    Bien cordialement,

    Stéphane Mattel
    Gérant – Style et Matière
    5, route de Lobsann
    67250 Lampertsloch
    Tél: 06.38.70.45.76`
      },
      
      "testimonial": {
        "subject": "Style et Matière - Merci pour votre confiance !",
        "body": `Bonjour {{CLIENT_NAME}},

    Je tenais à vous remercier pour votre confiance dans la réalisation de vos travaux de {{WORK_TYPE}}.

    Ce fut un plaisir de travailler sur votre projet et j'espère que le résultat répond à vos attentes.

    **Votre avis compte !**
    Si vous êtes satisfait(e) du travail réalisé, un témoignage de votre part serait très précieux pour moi. Cela m'aiderait beaucoup à développer mon activité.

    Vous pouvez répondre à ce message avec quelques mots sur:
    - Votre satisfaction générale
    - La qualité du travail
    - Le respect des délais
    - Notre collaboration 
  
    Je reste disponible si vous avez besoin de quoi que ce soit à l'avenir.

    Avec toute ma reconnaissance,
    
    Stéphane Mattel
    Gérant – Style et Matière
    5, route de Lobsann
    67250 Lampertsloch
    Tél: 06.38.70.45.76`
      }
    },

  // --- Placeholder mappings for document generation ---
  "placeholder_mappings": {
    "devis_numero": "{{devis_numero}}",
    "devis_date": "{{devis_date}}",
    "devis_validity_date": "{{devis_validity_date}}",
    "client_name": "{{client_name}}",
    "client_address": "{{client_address}}",
    "client_postal_code": "{{client_postal_code}}",
    "client_city": "{{client_city}}",
    "client_email": "{{client_email}}",
    "client_phone": "{{client_phone}}",
    "work_type": "{{work_type}}",
    "estimated_duration": "{{estimated_duration}}",
    "sous_total_ht": "{{SOUS_TOTAL_HT}}",
    "tva_taux": "{{TVA_TAUX}}",
    "montant_tva": "{{MONTANT_TVA}}",
    "total_ttc": "{{TOTAL_TTC}}",
    "montant_acompte": "{{MONTANT_ACOMPTE}}",
    "montant_acompte_verse": "{{MONTANT_ACOMPTE_VERSE}}",
    "solde_a_payer": "{{SOLDE_A_PAYER}}",
    "renovation_attestation": "{{renovation_attestation}}",
    "mention_speciale": "{{MENTION_SPECIALE}}",
    "ligne_remise": "{{LIGNE_REMISE}}",
    "ligne_remise_end": "{{/LIGNE_REMISE}}",
    "ligne_remise_label": "{{LIGNE_REMISE_LABEL}}",
    "ligne_remise_valeur": "{{LIGNE_REMISE_VALEUR}}"
  }
};