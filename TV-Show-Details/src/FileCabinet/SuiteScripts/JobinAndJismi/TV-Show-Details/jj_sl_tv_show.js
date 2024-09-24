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
 * Title: Fetch TV Show Details Using API Call and Display in a Suitelet Page
 * 
 * Author: Jobin And Jismi IT Services LLP
 * 
 * Date Created: 25-Sep-2024
 *
 * Description: This Suitelet script allows users to search for TV show details by entering a 
 *              show name. It fetches data from the TVmaze API based on the user's input and 
 *              displays the results in a structured format on the Suitelet page. The interface 
 *              includes a search field for entering the show name and a sublist to present the 
 *              retrieved details, such as the show’s name, type, language, and URL.
 * 
 * Revision History: 1.0
 * 
 ************************************************************************************************/
define(['N/record', 'N/search', 'N/ui/serverWidget', 'N/url', 'N/https', 'N/log'],
    /**
     * @param {record} record
     * @param {search} search
     * @param {serverWidget} serverWidget
     * @param {url} url
     * @param {https} https
     * @param {log} log
     */
    (record, search, serverWidget, url, https, log) => {
        /**
         * Defines the Suitelet script trigger point.
         * @param {Object} scriptContext
         * @param {ServerRequest} scriptContext.request - Incoming request
         * @param {ServerResponse} scriptContext.response - Suitelet response
         * @since 2015.2
         */
        const onRequest = (scriptContext) => {
            try {
                if (scriptContext.request.method === 'GET') {
                    let form = createForm(scriptContext);
                    scriptContext.response.writePage(form);
                } else {
                    displayShowDetails(scriptContext);
                }
            } catch (error) {
                log.error({
                    title: 'Error in onRequest',
                    details: error
                });
                scriptContext.response.write('An error occurred while processing your request.');
            }
        };


        /**
         * Creates a Suitelet form for searching TV shows.
         *
         * @param {Object} scriptContext - The scriptContext object provided by NetSuite.
         * @param {string} [searchValue] - The TV show name to retain in the search field.
         * @returns {Object} The constructed form object.
         */
        function createForm(scriptContext, searchValue) {
            try {
                let form = serverWidget.createForm({ title: 'TV Show Search' });

                let searchField = form.addField({
                    id: 'custpage_jj_show_name',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Enter TV Show Name'
                });

                searchField.defaultValue = searchValue || ''; // Retain the search value if present

                form.addSubmitButton({ label: 'Search Shows' });

                let sublist = form.addSublist({
                    id: 'custpage_jj_results',
                    type: serverWidget.SublistType.LIST,
                    label: 'Search Results'
                });

                sublist.addField({
                    id: 'custpage_jj_name',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Name'
                });
                sublist.addField({
                    id: 'custpage_jj_type',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Type'
                });
                sublist.addField({
                    id: 'custpage_jj_language',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Language'
                });
                sublist.addField({
                    id: 'custpage_jj_url',
                    type: serverWidget.FieldType.URL,
                    label: 'URL'
                });

                return form;
            } catch (error) {
                log.error({
                    title: 'Error in createForm',
                    details: error
                });

            }
        }


        /**
         * Handles the POST request for searching TV shows and displays results.
         *
         * @param {Object} scriptContext - The scriptContext object provided by NetSuite.
         */
        function displayShowDetails(scriptContext) {
            try {
                let showName = scriptContext.request.parameters.custpage_jj_show_name;

                log.debug("Show Name", showName);
                let form = createForm(scriptContext, showName);

                if (showName) {
                    let apiUrl = 'https://api.tvmaze.com/search/shows?q=' + encodeURIComponent(showName);
                    let response = https.get({ url: apiUrl });

                    let shows = JSON.parse(response.body);
                    let sublist = form.getSublist({ id: 'custpage_jj_results' });
                    for (let i = 0; i < shows.length; i++) {
                        let show = shows[i].show;
                        sublist.setSublistValue({ id: 'custpage_jj_name', line: i, value: show.name || 'N/A' });
                        sublist.setSublistValue({ id: 'custpage_jj_type', line: i, value: show.type || 'N/A' });
                        sublist.setSublistValue({ id: 'custpage_jj_language', line: i, value: show.language || 'N/A' });
                        sublist.setSublistValue({ id: 'custpage_jj_url', line: i, value: show.url || 'N/A' });
                    }
                }

                scriptContext.response.writePage(form);
            } catch (error) {
                log.error({
                    title: 'Error in displayShowDetails',
                    details: error
                });
                scriptContext.response.write('An error occurred while retrieving show details.');
            }
        }

        return { onRequest };
    }
);
