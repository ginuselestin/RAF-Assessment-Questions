/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */

/*************************************************************************************************
 * 
 * Client Name: NA
 * 
 * Jira Code: RAF Assessment Questions
 * 
 * Title: Fetch the List of Universities i Different Countries Using API Call and Display in a 
 *        Suitelet Page
 * 
 * Author: Jobin And Jismi IT Services LLP
 * 
 * Date Created: 03-Oct-2024
 *
 * Description: This Suitelet script enables users to search for university details by selecting 
 * a country (India, China, or Japan). It fetches data from the Hipolabs API based on the user's 
 * selection and displays the results in a structured format on the Suitelet page. The interface 
 * features a dropdown for country selection and a sublist to present the retrieved details, 
 * including the university name, state/province, and a hyperlink to the university's website.
 * 
 * Revision History: 1.0
 * 
 ************************************************************************************************/

define(['N/ui/serverWidget', 'N/http', 'N/log', 'N/ui/message'],
    /**
 * @param{http} http
 * @param{serverWidget} serverWidget
 * @param{url} url
 * @param{log} log
 * @param{message} message
 * 
 */
    (serverWidget, http, log, message) => {
        /**
         * Defines the Suitelet script trigger point.
         * @param {Object} scriptContext
         * @param {ServerRequest} scriptContext.request - Incoming request
         * @param {ServerResponse} scriptContext.response - Suitelet response
         * @since 2015.2
         */
        const onRequest = (scriptContext) => {

            if (scriptContext.request.method === 'GET' || 'POST') {
                displayForm(scriptContext);
            }
        }

        /**
         * Displays the form for country selection.
         * @param {Object} scriptContext - The scriptContext object containing the response object.
         * @returns {void}
         */
        const displayForm = (scriptContext) => {
            const form = serverWidget.createForm({ title: 'University List' });

            const countryField = form.addField({
                id: 'custpage_jj_country',
                type: serverWidget.FieldType.SELECT,
                label: 'Country'
            });

            countryField.addSelectOption({ value: '', text: '' });
            countryField.addSelectOption({ value: 'india', text: 'India' });
            countryField.addSelectOption({ value: 'china', text: 'China' });
            countryField.addSelectOption({ value: 'japan', text: 'Japan' });

            form.addSubmitButton({ label: 'Submit' });
            const selectedCountry = scriptContext.request.parameters.custpage_jj_country;
            if (selectedCountry) {
                countryField.defaultValue = selectedCountry;
                populateUniversitySublist(form, selectedCountry);
            }

            scriptContext.response.writePage(form);
        };

        /**
         * Populates the university sublist based on the selected country.
         * @param {Object} form - The form object to which the sublist is added.
         * @param {string} selectedCountry - The country selected by the user.
         * @returns {void}
         */
        const populateUniversitySublist = (form, selectedCountry) => {
            const apiUrl = `http://universities.hipolabs.com/search?country=${selectedCountry}`;
            const response = http.get({
                url: apiUrl,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });

            const universities = JSON.parse(response.body);
            const sublist = form.addSublist({
                id: 'custpage_jj_university_list',
                label: 'Universities',
                type: serverWidget.SublistType.LIST
            });

            sublist.addField({
                id: 'custpage_jj_country_name',
                type: serverWidget.FieldType.TEXT,
                label: 'Country'
            });

            sublist.addField({
                id: 'custpage_jj_state_province',
                type: serverWidget.FieldType.TEXT,
                label: 'State/Province'
            });

            sublist.addField({
                id: 'custpage_jj_web_pages',
                type: serverWidget.FieldType.URL,
                label: 'Web Pages'
            });

            universities.forEach((university, index) => {
                sublist.setSublistValue({
                    id: 'custpage_jj_country_name',
                    line: index,
                    value: university.country
                });

                sublist.setSublistValue({
                    id: 'custpage_jj_state_province',
                    line: index,
                    value: university.state || 'N/A'
                });

                sublist.setSublistValue({
                    id: 'custpage_jj_web_pages',
                    line: index,
                    value: university.web_pages[0] || 'N/A'
                });
            });
        };

        return { onRequest }

    });
